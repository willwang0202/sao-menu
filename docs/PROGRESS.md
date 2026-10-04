# Progress log — 2026-10-04

## Released
- **0.1.8** published (https://github.com/willwang0202/sao-menu/releases/tag/v0.1.8): ALO/GGO themes, SAO clock + Message button widgets, Link Start languages, Equipment apps, Help → support page, HP in front of launcher. Website points at 0.1.8.
- Release pipeline now builds/publishes only: universal Mac (DMG + updater ZIP), universal Windows (x64+Arm64 NSIS), Linux x86_64 AppImage, 3 update feeds, source. Gate: `node scripts/verify-release-assets.mjs <reports-dir>`.

## In progress — branch `feat/field-map` (pushed except the last local commits)
Done and committed:
- Navigation → Field Map: MapLibre + OpenFreeMap tiles restyled like the anime's Dungeon Map (portrait white card, cyan map, blue paths), orange player arrow, caption with place + coordinates, zoom/Locate.
- macOS Core Location helper (`src/desktop/location-helper.swift`, packaged as `location-helper`, location entitlement + usage text); fallback home location searched in Options (OpenStreetMap Nominatim).
- Map credit moved from the map face to Options → About.
- Message button shows only with unread messages, in the orange notified art.
- App renamed to **SAO Menu** (commit "feat: rename the app to SAO Menu", local); data stays in the old "SAO Utils 2" folder. macOS/Linux users may need to sign in once (keychain name follows the app name).

Open issue being fixed:
- On this branch, reloading the launcher page quits the app (main is fine). Suspect MapLibre loading at startup; uncommitted change lazy-loads `src/ui/field-map.tsx` (new `src/ui/field-map-size.ts`). Verify with `npm run build` then `node --import tsx scripts/smoke-startup.mjs`; also fix the TS error: `main.tsx` must import `FIELD_MAP_SIZE` from `./field-map-size`.
- Desktop smoke test (`scripts/smoke-desktop.mjs`) had an intermittent TimeoutError (2 of ~8 runs); cause not yet caught.

## Next steps
1. Finish the reload fix, run `npm test`, `npm run build`, `scripts/smoke-desktop.mjs`, `smoke-startup.mjs`, `smoke-hover.mjs` (quit Calculator after).
2. Real-device check: Field Map location prompt in a signed build (Location Services permission).
3. Merge `feat/field-map` into `main`, bump to 0.1.9 (CHANGELOG), release with the consolidated pipeline (stage assets → draft + tag → CI → replace Mac with local signed universal build → `update-feeds.mjs` → gate → publish), update `web/lib/release.ts`, push.
4. Open questions for the user: Message popup design (references in `output/references/`), Always on top default.
