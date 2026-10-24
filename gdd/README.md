# VEILKEEP GDD

Single source of truth: `gdd.md`. The interactive HTML document is generated from it.

## Build

```sh
python build.py
```

This reads `gdd.md` and writes `index.html` (interactive, with sidebar nav, search, map, tabs).

Edit `gdd.md`, then rebuild. Do not edit `index.html` directly.
