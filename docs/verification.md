# Current test release verification

The 0.1.2 startup/HUD/browser source has been checked on October 3, 2026. Packaging verification is recorded in `output/current-package.json`; the current release is unsigned and not notarized. Windows/Linux runtime behavior remains unverified.

- `npm test`: 81/81 passed, including real SQLite account rules, original startup byte/metadata checks, CPU/RAM headroom, display frequency normalization, FOV mapping/limits and the independently merged hand-gesture suite.
- Production TypeScript, Vite, Electron host/preloads and the Swift helper built successfully.
- Native startup/HUD acceptance passed: selected 1920×1080 anime video and Japanese audio, animated sensor/login/entry transitions, actual full-display bounds including the menu-bar area, aligned real account login, offline continuation, no replay, reduced motion/sound off, HP hidden before login/after logout, original HP geometry, stats and bridge isolation.
- Measured interactive RAF on a 120.000008Hz display: median 8.3ms, p95 10.2ms, zero missed intervals in a two-second probe. Movie probe observed 51 presented source frames and zero video drops. The recording retains its original 23.976fps cadence; these samples do not guarantee performance on all hardware.
- Native frame captures compare 24 adjacent-tunnel and stage-landmark screenshots at source timestamps. Source video is reused without recoloring, retiming or video reencoding. [Community comparisons](startup-references.md) identify which recreations were inspected and their differences; exact full-app parity remains unfinished.
- Native curved browser/media acceptance passed: actual GPU pixels with BGRA channel order, 120Hz painting/pointer targets, live 100° FOV slider, correctly mapped clicks/typing, links/history, isolated remote page, rejected privileged URLs, simultaneous PNG/original GIF/looping WebM, pause/resume, capability revocation/range streaming and previews surviving launcher dismissal. Saved 88° FOV restored after a process restart; Reset returned it to 45°.
- Native hover acceptance passed: root and submenu artwork through twelve native handoffs, delayed image decoding, Reduced Motion and transparent screenshot pixels outside the menu. Desktop acceptance passed original fonts/sprite measurements, fixed root rail, category-anchored submenu movement, native launch, input passthrough, settings/import/export, dismissal/hide/reopen and reload.
- Final review regressions passed: the test first reproduced clipped service/input controls at 5120×1440 and 900×1600, then verified all controls stay in view. A local service returning a login token followed by HTTP 401 from session validation first triggered the entry sequence; the fix retains login, shows the error and keeps HP hidden.
- Merged hand-gesture acceptance passed using Chromium’s synthetic camera: opt-in lifecycle, isolated camera access, pointing/clicking, debug-window behavior and shutdown.
- Native gallery acceptance passed all 18 original shaders, pause/wheel controls, native file drops, replacement/token revocation and exact layout restoration after process restart.
- Native two-account social acceptance passed: local registration, friend requests/acceptance, presence, Message Box, messages in both directions, unread/read state, rejected unknown recipients, persisted history, encrypted credential restoration and logout. Earlier failures came from asynchronous Playwright polling and ambiguous test locators; the fixtures now poll native state and select the intended log/textbox explicitly.

The user physically confirmed global downward invocation, outside dismissal and upward dismissal with another app focused; this acceptance is retained. Cloudflare hosting at favioon.com remains authorized but undeployed. Account testing used disposable localhost identities. Complete original compositor parameters, preferences, remaining widgets and plug-ins remain parity work; see [compatibility](compatibility.md).

## Earlier 0.1.1 baseline

The first Git release established hover/transparency fixes and native menu acceptance. Its source remains tagged v0.1.1. Generated 0.1.1 artifacts are replaced by the verified current release; Git history preserves the previous verification record.

## Review follow-ups

The fresh reviewer found no critical issues. Both important findings were fixed and verified by a native failing-then-passing test. Two minor items remain: late media errors after a reduced-motion login form mounts are not reflected in its copied error state, and the browser needs automatic WebGL resource recreation after GPU context loss. Physical display hot-plug is untested.
