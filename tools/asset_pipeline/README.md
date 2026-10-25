# VEILKEEP asset pipeline

Deterministic, idempotent generators for the assets specified in GDD §42–46 and
itemised in [`docs/ASSET_AND_INTEGRATION_MANIFEST.md`](../../docs/ASSET_AND_INTEGRATION_MANIFEST.md).

Every script writes its outputs in place (never appends), keeps its source data
next to it in the repo, and is safe to re-run. A re-run must produce the same
bytes or an explained diff.

## Status

| Script | Produces | Status |
| --- | --- | --- |
| `fetch_surfaces.py` | 17 CC0 PBR surface sets + night HDRI, `threejs/src/data/pbr_materials.json`, `CREDITS.md` | **done** |
| `generate_meshes.py` | kit pieces, props, character/enemy meshes | planned (Phase 3) |
| `generate_rigs_and_anims.py` | armatures, weights, baked NLA clip tracks | planned (Phase 3) |
| `generate_texts.py` | `ui` / `barks` / `lore` / `ask_wizard` / `bestiary` / `pods` JSON | planned (Phase 3) |
| `build_rooms.py` | the 16 room templates assembled from the kit | planned (Phase 2) |
| `validate_assets.py` | GLB, rig, budget and `-col`/`-nav` suffix validation | planned |
| `manifest_report.py` | coverage table written back into the manifest doc | planned |

Existing generators from the prototype (`build_veilkeep_room_kit.py`,
`build_s00_courtyard.py`, `blender_gen_*.py`, `export_s00_batched.py`) are the
reference implementations for `VK_*` material naming, bevel treatment and export
settings. They are superseded piece by piece, not rewritten in one pass.

## fetch_surfaces.py

```bash
# from the repository root; needs Python 3 and Pillow
python tools/asset_pipeline/fetch_surfaces.py
```

Downloads `ambientCG` 1K JPG archives through the public API, keeps
Color / NormalGL / Roughness / AmbientOcclusion, downsamples Roughness and AO to
512 px for the mobile budget, and rewrites:

- `threejs/public/assets/textures/pbr/<slug>/{color,normal,roughness,ao}.jpg`
- `threejs/public/assets/textures/pbr/night_sky_moon/sky_1k.exr`
- `threejs/public/assets/textures/pbr/CREDITS.md`
- `threejs/src/data/pbr_materials.json`

To add a surface, append a row to `CURATED` and re-run. To retire one, delete its
row and the folder. `threejs/tests/assetManifest.test.ts` fails if the index and
the files on disk disagree, so a half-finished edit cannot ship.

All ambientCG assets are CC0 1.0 (public domain). The CDN requires a browser
User-Agent and an `ambientcg.com` Referer; both are set in `get()`.
