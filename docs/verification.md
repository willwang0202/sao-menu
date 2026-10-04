# Current test release verification

## 0.1.6 release preparation

The renamed `sao-menu` source passed 102/102 unit/protocol tests, the desktop production build and the website TypeScript/Next.js production build. The local browser acceptance test passed registration, friendship, direct-message round trips, logout, mobile layouts, platform download links and the GitHub issue-form/issue-list links. It used a disposable PGlite database. Native hand-gesture acceptance passed with Chromium's synthetic camera, carrying forward the already merged hand-tracking work.

Native signup/HUD acceptance passed real launch-screen registration, account-name override of old local preferences, battery percentage and solo gating. Two native accounts passed friendship-only/pending-invitation gating, party acceptance with correct companion names, persistence, leaving and resizing back to one bar. Login recovery passed portrait and ultrawide registration controls and rejected sessions. Both SQLite and Postgres tests enforce private battery presence, invite ownership, party persistence, leader succession and six-player capacity under simultaneous acceptance.

Native release CI verifies the tagged resource SHA-256, packaged renderer/host/icon bytes and installer presence, then launches the packaged binary on Apple Silicon macOS, Intel macOS, Windows x64 and Linux x64. Completion and installer checksums are recorded after those jobs finish; a queued build is not a runtime-verification result.

## Earlier 0.1.3 release

The Apple Silicon 0.1.3 app, ZIP and DMG were built and verified on October 3, 2026. The packaged native and JavaScript versions both report 0.1.3. All 1,111 packaged renderer, host and icon files match the final build, and no obsolete renderer files remain. electron-builder signed the app with the local Developer ID Application certificate; `codesign --verify --deep --strict` passes. The app is not notarized, so Gatekeeper reports "Unnotarized Developer ID". Signing rewrites the gesture helper's signature, so its machine code and strings are compared per architecture rather than byte for byte. Both match. ZIP and DMG integrity checks passed; checksums are in `output/current-package.json`. Windows/Linux runtime behavior remains unverified.

- `npm test`: 94/94 passed, including the Link Start clock, audio follow, cover scaling, keyframes, scene order and the audio/reference checksums.
- Native startup acceptance on the release build, with a 120Hz display, used the procedural Link Start and the reference's Japanese voice/SFX track. Every scene had a median frame interval of 8.3ms and a p95 of 9.4–9.9ms. Late frames: sensors 1, language 2, all others 0. A new canvas frame was drawn on each refresh. The entry sequence played through the warp after real login. Full-display bounds were compared with the display the window opened on, because a second monitor was connected.
- Desktop, hover, social, surfaces/gallery and hand-gesture native suites passed again on the release build.
- `node scripts/compare-startup.mjs` renders side-by-side checks against the reference. Composition, timing and palette match; fine detail is approximate (see [references](startup-references.md)).

## Earlier 0.1.2 release

The Apple Silicon 0.1.2 app and ZIP were built and verified on October 3, 2026. The packaged native and JavaScript versions both report 0.1.2; all 1,111 packaged renderer/host/icon files match the final build, no obsolete renderer files remain, and the helper/icon match their source artifacts. ZIP integrity passed. Only the current release app and ZIP are retained. Checksums are recorded in `output/current-package.json`; the build is unsigned and not notarized. Windows/Linux runtime behavior remains unverified.

- `npm test`: 81/81 passed, including real SQLite account rules, original startup byte/metadata checks, CPU/RAM headroom, display frequency normalization, FOV mapping/limits and the independently merged hand-gesture suite.
- Production TypeScript, Vite, Electron host/preloads and the Swift helper built successfully.
- Native startup/HUD acceptance passed: selected 1920×1080 anime video and Japanese audio, animated sensor/login/entry transitions, actual full-display bounds including the menu-bar area, aligned real account login, offline continuation, no replay, reduced motion/sound off, HP hidden before login/after logout, original HP geometry, stats and bridge isolation.
- Measured interactive RAF on a 120.000008Hz display: median 8.3ms, p95 10.1ms, zero missed intervals in a two-second probe. Movie probe observed 51 presented source frames and zero video drops. The recording retains its original 23.976fps cadence; these samples do not guarantee performance on all hardware.
- Native frame captures compare 24 adjacent-tunnel and stage-landmark screenshots at source timestamps. Source video is reused without recoloring, retiming or video reencoding. [Community comparisons](startup-references.md) identify which recreations were inspected and their differences; exact full-app parity remains unfinished.
- Native curved browser/media acceptance passed: actual GPU pixels with BGRA channel order, 120Hz painting/pointer targets, live 100° FOV slider, correctly mapped clicks/typing, links/history, isolated remote page, rejected privileged URLs, simultaneous PNG/original GIF/looping WebM, pause/resume, capability revocation/range streaming and previews surviving launcher dismissal. Saved 88° FOV restored after a process restart; Reset returned it to 45°.
- Native hover acceptance passed: root and submenu artwork through twelve native handoffs, delayed image decoding, Reduced Motion and transparent screenshot pixels outside the menu. Desktop acceptance passed original fonts/sprite measurements, fixed root rail, category-anchored submenu movement, native launch, input passthrough, settings/import/export, dismissal/hide/reopen and reload.
- Final review regressions passed: the test first reproduced clipped service/input controls at 5120×1440 and 900×1600, then verified all controls stay in view. A local service returning a login token followed by HTTP 401 from session validation first triggered the entry sequence; the fix retains login, shows the error and keeps HP hidden.
- Merged hand-gesture acceptance passed using Chromium’s synthetic camera: opt-in lifecycle, isolated camera access, pointing/clicking, debug-window behavior and shutdown.
- Native gallery acceptance passed all 18 original shaders, pause/wheel controls, native file drops, replacement/token revocation and exact layout restoration after process restart.
- Native two-account social acceptance passed: local registration, friend requests/acceptance, presence, Message Box, messages in both directions, unread/read state, rejected unknown recipients, persisted history, encrypted credential restoration and logout. Earlier failures came from asynchronous Playwright polling and ambiguous test locators; the fixtures now poll native state and select the intended log/textbox explicitly.

The user physically confirmed global downward invocation, outside dismissal and upward dismissal with another app focused; this acceptance is retained. Account testing for 0.1.3 used disposable localhost identities. The hosted service at sao.favioon.com was deployed afterwards; its verification is recorded in [hosted service](hosted-service.md). Complete original compositor parameters, preferences, remaining widgets and plug-ins remain parity work; see [compatibility](compatibility.md).

## Earlier 0.1.1 baseline

The first Git release established hover/transparency fixes and native menu acceptance. Its source remains tagged v0.1.1. Generated 0.1.1 artifacts are replaced by the verified current release; Git history preserves the previous verification record.

## Review follow-ups

The fresh reviewer found no critical issues. Both important findings were fixed and verified by a native failing-then-passing test. Two minor items remain: late media errors after a reduced-motion login form mounts are not reflected in its copied error state, and the browser needs automatic WebGL resource recreation after GPU context loss. Physical display hot-plug is untested.
