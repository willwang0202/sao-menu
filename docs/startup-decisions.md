# Startup release decisions

The following records the implementation decisions and fresh review findings for the local 0.1.2 release. The earlier procedural-startup decision was superseded by the user’s subsequent selection of actual anime footage.

## Decisions

- Ruling: use the existing user-authorized workspace/main branch — this task continues the user's current build and local Git history; cost if wrong: branch can be made before sharing.
- Ruling: HP uses the original preset CPU/RAM headroom and unknown level rather than invented game statistics — this reproduces the bundled mechanism; cost if wrong: the user's preferred name/data can be configured later.
- Ruling: reconstruct startup graphics from the supplied clips while importing the bundled Japanese voice unchanged — the visual scene is not present as a reusable bundle asset; cost if wrong: visual parity needs comparison and refinement.
- Ruling: HP requires a real account snapshot after native startup completion and hides on logout — the user explicitly requested no HP before login — cost if wrong: offline users have no persistent HP until they authenticate.
- Ruling: use the user-selected anime source unchanged at its available 1080p/23.976fps, replacing the procedural tunnel and Integral Factor clip — the user authorized actual high-quality footage and selected this reference — cost if wrong: recorded visuals retain source cadence rather than unique frames at monitor refresh.
- Ruling: use edge-to-edge 16:9 cover presentation and macOS simple fullscreen during startup — native frame bounds otherwise clamp below the menu bar — cost if wrong: non-16:9 screens crop the footage at the sides or top/bottom.
- Ruling: keep community recreations as motion/GPU references while the anime footage remains the visual authority — their custom sequences differ from the selected login clip — cost if wrong: a vector recreation with closer full-sequence parity may be found later.
- Final: Ruling: retain the native hot-plug/fullscreen implementation after static review and single-display native bounds checks — the reviewer did not execute physical display hot-plug, and no second physical display is available to this task — cost if wrong: a display reconnection could require reopening the overlay.
- Final: Ruling: preserve independently merged hand tracking after its native synthetic-camera acceptance passed — unrelated hand internals are outside this startup change — cost if wrong: physical hand-recognition quality still needs the user's real-camera feedback.
- Final: Ruling: rely on checked source bytes and documented creator references for visual provenance — no claim of redistribution permission follows from those sources — cost if wrong: replacing an asset may be needed before any public distribution.

## Deferred minor findings

- Final: minor (deferred): late video playback errors after the reduced-motion login form mounts are not reflected in its copied error state.
- Final: minor (deferred): WebGL browser does not recreate its resources automatically after GPU context loss.

## Fixed review findings

- Ultrawide service controls and portrait account inputs were clipped. A native reproduction failed at 5120×1440 and 900×1600, then passed after moving tools to viewport coordinates and bounding input widths.
- Session validation could fail after login while the entry sequence still played. A local login-token/HTTP-401 reproduction failed, then passed after authentication required a connected account snapshot.

All 81 unit tests and the complete native startup/HP check passed after these fixes. Native hand integration, menu/hover, browser/FOV, media/gallery and two-account social acceptance also passed in this release cycle. Packaging is verified separately in output/current-package.json.

## Real-time reconstruction (after 0.1.2)

- Ruling: replace the anime footage with a canvas reconstruction drawn every display refresh, timed and coloured from frame measurements of the same clip — the user asked for the animation to match the reference exactly and follow the screen's refresh rate rather than play a 24fps video — cost if wrong: fine details (dial segments, warp blur) differ from the film and need further tuning against `scripts/compare-startup.mjs`.
- Ruling: keep the reference's own audio track, stream-copied without re-encoding, and lock the picture to it — the voice and effects are part of the sequence and were not asked to change — cost if wrong: the audio can be swapped through the manifest.
- Ruling: hold on the empty login card (10.62s) and resume at its fade-out (11.64s) with real credential lengths shown as asterisks — the source's typed placeholder login is not presented as a real one — cost if wrong: the hold/resume points are single constants in `src/ui/link-start/timeline.ts`.
- Ruling: cap the canvas at 2× device pixels and avoid canvas blur filters — a blur filter dropped the blue dive to about 40fps at Retina resolution — cost if wrong: softer details would need a GPU shader path.
