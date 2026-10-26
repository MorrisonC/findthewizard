"""Stage ambientCG CC0 PBR materials + one night HDRI for VEILKEEP.

Downloads the 1K JPG archive for each curated asset, keeps Color / NormalGL /
Roughness / AmbientOcclusion, downsamples Roughness+AO to 512 px for the mobile
budget, and writes:

  threejs/public/assets/textures/pbr/<slug>/*.jpg   the maps
  threejs/public/assets/textures/pbr/CREDITS.md     provenance table
  threejs/src/data/pbr_materials.json               the index the game imports

The script is idempotent: archives are cached in the staging directory, outputs
are overwritten in place, and nothing is appended. Re-running it after editing
CURATED is how the surface kit grows.

Usage (from the repository root, Python 3 + Pillow):

    python tools/asset_pipeline/fetch_surfaces.py

ambientCG serves its CDN only to requests that look like a browser, so every
request carries a desktop User-Agent and an ambientcg.com Referer.
"""
import io
import json
import os
import urllib.request
import zipfile

from PIL import Image

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEST = os.path.join(ROOT, "threejs", "public", "assets", "textures", "pbr")
INDEX = os.path.join(ROOT, "threejs", "src", "data", "pbr_materials.json")
STAGE = os.path.join(os.environ.get("TEMP", "/tmp"), "veilkeep_acg_stage")
API = "https://ambientcg.com/api/v2/full_json"

# slug -> (assetId, surface role, world metres covered by one UV tile, note)
CURATED = [
    ("courtyard_cobble", "PavingStones051", "floor", 3.0, "Outer Wards / Approach courtyard cobble"),
    ("dungeon_slab", "PavingStones127", "floor", 4.0, "Undercrypt and corridor slabs"),
    ("castle_floor_broken", "Tiles130", "floor", 3.0, "Ruined chapel / crypt flagstones"),
    ("sanctum_marble", "Marble006", "floor", 4.0, "Sanctum inlay, polished dark marble"),
    ("parlour_parquet", "Wood051", "floor", 2.0, "Gilded Dollhouse / banquet parquet"),
    ("planks_weathered", "Planks037A", "wood", 2.0, "Crates, shutters, doors, scaffolding"),
    ("wall_ashlar", "Bricks066", "wall", 3.0, "Fortress ashlar, cold grey"),
    ("wall_brick_medieval", "Bricks094", "wall", 2.5, "Gatehouse and barracks brick"),
    ("wall_plaster_aged", "Plaster007", "wall", 3.0, "Interior parlour plaster"),
    ("metal_plate_rusted", "MetalPlates013", "metal", 2.0, "Clockwork Spire plating, boiler rooms"),
    ("bronze_eroded", "Metal017", "metal", 1.0, "Sconces, statuary, door furniture"),
    ("copper_dirty", "Metal047B", "metal", 1.5, "Steam conduits and pressure vessels"),
    ("gold_gilt", "Metal048C", "metal", 0.75, "Antique gold trim (#d4af37 accent)"),
    ("fabric_wool_red", "Fabric085", "cloth", 1.0, "Banners, drapes, carpet runners"),
    ("roof_clay_tiles", "RoofingTiles014B", "roof", 2.0, "Keep and gatehouse roofs"),
    ("ground_gravel", "Ground110", "ground", 4.0, "Courtyard soil, gravel paths"),
    ("snow_trodden", "Snow013", "ground", 3.0, "Winter Gauntlet snowdrifts"),
]

HDRI = ("night_sky_moon", "NightSkyHDRI003", "HDRI night sky with moon for PMREM backdrop")

MAP_SUFFIXES = {
    "color": ["_Color"],
    "normal": ["_NormalGL", "_Normal"],
    "roughness": ["_Roughness"],
    "ao": ["_AmbientOcclusion", "_AO"],
}

# Roughness and AO are low-frequency, so half resolution is invisible in-game.
MAP_RESOLUTION = {"color": 1024, "normal": 1024, "roughness": 512, "ao": 512}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://ambientcg.com/"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def fetch_asset(asset_id):
    """Return the ambientCG metadata record for a material or HDRI asset."""
    for data_type in ("Material", "HDRI"):
        url = f"{API}?type={data_type}&id={asset_id}&limit=1&include=downloadData"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            meta = json.loads(r.read().decode("utf-8"))
        asset = (meta.get("foundAssets") or [None])[0]
        if asset:
            return asset
    raise RuntimeError(f"asset not found: {asset_id}")


def download_entry(asset_id, wanted_prefix):
    """Return (asset, download) for the archive whose attribute starts with `wanted_prefix`."""
    asset = fetch_asset(asset_id)
    downloads = []
    for folder in (asset.get("downloadFolders") or {}).values():
        for category in (folder.get("downloadFiletypeCategories") or {}).values():
            downloads.extend(category.get("downloads") or [])
    for entry in downloads:
        if entry.get("attribute", "").startswith(wanted_prefix):
            return asset, entry
    raise RuntimeError(
        f"no {wanted_prefix} download for {asset_id}: {[d.get('attribute') for d in downloads]}"
    )


def fetch_archive(entry):
    """Download (or reuse) the zip and return its local path."""
    path = os.path.join(STAGE, entry["fileName"])
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(get(entry["downloadLink"]))
    return path


def stage_material(slug, asset_id, role, metres, note):
    asset, entry = download_entry(asset_id, "1K-JPG")
    print(f"{asset_id}: {entry['fileName']} ({entry['size'] / 1e6:.1f} MB)")
    archive = fetch_archive(entry)

    out_dir = os.path.join(DEST, slug)
    os.makedirs(out_dir, exist_ok=True)
    record = {
        "assetId": asset_id,
        "displayName": asset.get("displayName"),
        "role": role,
        "metresCovered": metres,
        "note": note,
        "sourceUrl": asset.get("shortLink"),
        "maps": {},
    }

    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        for kind, suffixes in MAP_SUFFIXES.items():
            match = None
            for name in names:
                base = os.path.basename(name).lower()
                if any(base.endswith(suffix.lower() + ext) for suffix in suffixes for ext in (".jpg", ".png")):
                    match = name
                    break
            if not match:
                print(f"  ! missing {kind} for {asset_id}")
                continue
            image = Image.open(io.BytesIO(z.read(match))).convert("RGB")
            target = MAP_RESOLUTION[kind]
            if image.width > target:
                image = image.resize((target, target), Image.LANCZOS)
            filename = f"{kind}.jpg"
            image.save(os.path.join(out_dir, filename), quality=92, optimize=True)
            record["maps"][kind] = f"assets/textures/pbr/{slug}/{filename}"

    size = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
    record["bytes"] = size
    print(f"  -> {slug}: {size / 1e6:.2f} MB")
    return record, (slug, asset_id, asset.get("displayName"), role)


def stage_hdri():
    slug, asset_id, note = HDRI
    asset, entry = download_entry(asset_id, "1K")
    print(f"{asset_id}: {entry['fileName']} ({entry['size'] / 1e6:.1f} MB)")
    archive = fetch_archive(entry)

    out_dir = os.path.join(DEST, slug)
    os.makedirs(out_dir, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        candidates = [n for n in z.namelist() if n.lower().endswith((".hdr", ".exr"))]
        if not candidates:
            raise RuntimeError(f"no HDR/EXR in {entry['fileName']}")
        # Prefer EXR (half float, smaller than the RGBE .hdr for this asset).
        source = sorted(candidates, key=lambda n: n.lower().endswith(".exr"))[0]
        filename = "sky_1k" + os.path.splitext(source)[1].lower()
        with open(os.path.join(out_dir, filename), "wb") as f:
            f.write(z.read(source))

    size = os.path.getsize(os.path.join(out_dir, filename))
    print(f"  -> {slug}: {size / 1e6:.2f} MB")
    return {
        "assetId": asset_id,
        "displayName": asset.get("displayName"),
        "note": note,
        "sourceUrl": asset.get("shortLink"),
        "path": f"assets/textures/pbr/{slug}/{filename}",
        "bytes": size,
    }


def write_credits(index, credits, total):
    lines = [
        "# VEILKEEP PBR Texture Credits",
        "",
        "All surface materials and the night-sky HDRI in this folder come from "
        "[ambientCG](https://ambientcg.com) and are released under **CC0 1.0 Universal** "
        "(public domain, no attribution required; credited here for provenance).",
        "",
        "Downloaded via the ambientCG API (`/api/v2/full_json`), 1K JPG archive, "
        "Color/NormalGL kept at 1024 px, Roughness/AO downsampled to 512 px.",
        "",
        "| Folder | ambientCG asset | Display name | Surface role |",
        "|---|---|---|---|",
    ]
    for slug, asset_id, name, role in credits:
        lines.append(f"| `{slug}/` | [{asset_id}](https://ambientcg.com/a/{asset_id}) | {name} | {role} |")
    hdri = index["hdr"][HDRI[0]]
    lines.append(
        f"| `{HDRI[0]}/` | [{HDRI[1]}](https://ambientcg.com/a/{HDRI[1]}) | "
        f"{hdri['displayName']} | environment / skybox |"
    )
    lines += [
        "",
        f"Index: `threejs/src/data/pbr_materials.json`. Total staged payload: {total / 1e6:.1f} MB.",
        "Regenerate with `python tools/asset_pipeline/fetch_surfaces.py`.",
        "",
    ]
    with open(os.path.join(DEST, "CREDITS.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))


def main():
    os.makedirs(DEST, exist_ok=True)
    os.makedirs(STAGE, exist_ok=True)

    index = {
        "version": 1,
        "source": "ambientCG (CC0)",
        "license": "CC0-1.0",
        "mapScaleNote": "metresCovered is the world size one UV tile represents",
        "materials": {},
        "hdr": {},
    }
    credits = []
    total = 0

    for slug, asset_id, role, metres, note in CURATED:
        record, credit = stage_material(slug, asset_id, role, metres, note)
        index["materials"][slug] = record
        credits.append(credit)
        total += record["bytes"]

    index["hdr"][HDRI[0]] = stage_hdri()
    total += index["hdr"][HDRI[0]]["bytes"]

    with open(INDEX, "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, indent=2)
        f.write("\n")

    write_credits(index, credits, total)
    print(f"\nTOTAL {total / 1e6:.1f} MB")
    print(f"index -> {INDEX}")


if __name__ == "__main__":
    main()
