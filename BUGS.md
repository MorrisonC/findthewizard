# VEILKEEP — Bug Tracker

## Testing Status

- [x] Web (desktop Chrome) full playthrough (autoplay)
- [x] Auto-battler toggle and navigation
- [x] All 50 scenes load
- [x] All quests completable (simulated)
- [x] All puzzles solvable (simulated)
- [x] No visual bugs (missing textures, broken images) — 0 broken images
- [x] Autoplay works end-to-end
- [x] Auto-battler works (navigates, fights, solves)
- [x] Dialog displays correctly
- [x] Combat collisions work (distance-based)
- [x] Animations play (rigged GLBs)

## Bugs Found & Fixed

| # | Severity | Description | Status | Notes |
|---|----------|-------------|--------|-------|
| 1 | High | Auto-battler Campaign referenced `ITEM_GATEHOUSE_KEY` as collectible in OW1, but game grants `ITEM_IRON_NAIL` there | Fixed | Changed task to collect ITEM_IRON_NAIL |
| 2 | High | GH3 clear task didn't grant `ITEM_GATEHOUSE_KEY` (needed for WR1 door) in auto-battler sim | Fixed | Added ITEM_GATEHOUSE_KEY to GH3 grants |
| 3 | Medium | GDD image `scene00_approach.png` missing | Fixed | Changed to `scene00_approach_sunken.png` |
| 4 | Low | External GDD links opened in same tab | Fixed | Added target="_blank" |
| 5 | Low | GDD link regex broke on URLs with parentheses | Fixed | Improved regex for balanced parens |

## Playwright Test Runs

| Run | Date | Result | Notes |
|-----|------|--------|-------|
| 1 | 2026-10-26 | Pass | Autoplay: 4 zones in 60s, 0 errors, 0 broken images |
| 2 | 2026-10-26 | Pass | Auto-battler: progresses OW1→GH3, fights, solves, routes |
| 3 | 2026-10-26 | Pass | All 86 unit tests pass |

## Remaining (require external resources)

- WebGPU renderer (needs browser testing)
- Mobile store packaging (needs Capacitor + store accounts)
- Android device profiling (needs real mid-range device)
