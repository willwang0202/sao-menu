# Progress log — 2026-10-04

## Released
- **0.1.8** (https://github.com/willwang0202/sao-menu/releases/tag/v0.1.8): ALO/GGO themes, SAO clock + Message button widgets, Link Start languages, Equipment apps, Help → support page, HP in front of launcher.
- **0.1.10** published (https://github.com/willwang0202/sao-menu/releases/tag/v0.1.10); v0.1.9 was skipped because its tag pointed at a stale resource checksum: Navigation → Field Map, Message button only on unread (notified art), rename to SAO Menu.
- Release pipeline builds/publishes only: universal Mac (DMG + updater ZIP), universal Windows (x64+Arm64 NSIS), Linux x86_64 AppImage, 3 update feeds, source. Gate: `node scripts/verify-release-assets.mjs <reports-dir>`.

## State
- `feat/field-map` is merged into `main` (all 172 unit tests, build, desktop/startup/hover smoke pass; desktop smoke 10/10 after waiting for menu animations before clicks).
- Data folder stays `SAO Utils 2`; macOS/Linux users may need to sign in once (safeStorage key follows the app name).

## Next steps
1. Device check: Field Map Location Services prompt in the signed app.
2. Open questions for the user: Message popup design (references in `output/references/`), Always on top default.
3. Later: Congratulations banner, duel window, SAO window frames.
