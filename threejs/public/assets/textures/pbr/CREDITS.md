# VEILKEEP PBR Texture Credits

All surface materials and the night-sky HDRI in this folder come from [ambientCG](https://ambientcg.com) and are released under **CC0 1.0 Universal** (public domain, no attribution required; credited here for provenance).

Downloaded via the ambientCG API (`/api/v2/full_json`), 1K JPG archive, Color/NormalGL kept at 1024 px, Roughness/AO downsampled to 512 px.

| Folder | ambientCG asset | Display name | Surface role |
|---|---|---|---|
| `courtyard_cobble/` | [PavingStones051](https://ambientcg.com/a/PavingStones051) | Paving Stones 051 | floor |
| `dungeon_slab/` | [PavingStones127](https://ambientcg.com/a/PavingStones127) | Paving Stones 127 | floor |
| `castle_floor_broken/` | [Tiles130](https://ambientcg.com/a/Tiles130) | Tiles 130 | floor |
| `sanctum_marble/` | [Marble006](https://ambientcg.com/a/Marble006) | Marble 006 | floor |
| `parlour_parquet/` | [Wood051](https://ambientcg.com/a/Wood051) | Wood 051 | floor |
| `planks_weathered/` | [Planks037A](https://ambientcg.com/a/Planks037A) | Planks 037 A | wood |
| `wall_ashlar/` | [Bricks066](https://ambientcg.com/a/Bricks066) | Bricks 066 | wall |
| `wall_brick_medieval/` | [Bricks094](https://ambientcg.com/a/Bricks094) | Bricks 094 | wall |
| `wall_plaster_aged/` | [Plaster007](https://ambientcg.com/a/Plaster007) | Plaster 007 | wall |
| `metal_plate_rusted/` | [MetalPlates013](https://ambientcg.com/a/MetalPlates013) | Metal Plates 013 | metal |
| `bronze_eroded/` | [Metal017](https://ambientcg.com/a/Metal017) | Metal 017 | metal |
| `copper_dirty/` | [Metal047B](https://ambientcg.com/a/Metal047B) | Metal 047 B | metal |
| `gold_gilt/` | [Metal048C](https://ambientcg.com/a/Metal048C) | Metal 048 C | metal |
| `fabric_wool_red/` | [Fabric085](https://ambientcg.com/a/Fabric085) | Fabric 085 | cloth |
| `roof_clay_tiles/` | [RoofingTiles014B](https://ambientcg.com/a/RoofingTiles014B) | Roofing Tiles 014 B | roof |
| `ground_gravel/` | [Ground110](https://ambientcg.com/a/Ground110) | Ground 110 | ground |
| `snow_trodden/` | [Snow013](https://ambientcg.com/a/Snow013) | Snow 013 | ground |
| `night_sky_moon/` | [NightSkyHDRI003](https://ambientcg.com/a/NightSkyHDRI003) | Night Sky HDRI 003 | environment / skybox |

Index: `threejs/src/data/pbr_materials.json`. Total staged payload: 13.6 MB.
Regenerate with `python tools/asset_pipeline/fetch_surfaces.py`.
