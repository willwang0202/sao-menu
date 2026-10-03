# Startup, HP Display and Refresh Rate Implementation Plan

> Execute inline with executing-plans; the user has requested these concrete changes and authorized implementation.

**Goal:** Restore the reference presentation, add persistent original HP artwork, and implement the launch/login sequence with animation following display refresh.

**Architecture:** Dedicated native HP window with an owner-checked bridge; startup completion remains native process state. Existing account bridge handles real login. GPU scenes and requestAnimationFrame own presentation; native sampling and browser capture follow the matching monitor.

**Tech Stack:** TypeScript, React, Electron, WebGL2, CSS and native Playwright integration.

- [ ] **1. HP widget.** Add `src/shared/hud.ts`, `src/desktop/hud.ts`, `src/desktop/hud-preload.ts` and `src/ui/hud.tsx`/`hud.css`. Use the source mask offsets, 500ms interpolation, preset CPU/RAM inverse progress and safe unavailable-level fallback. Import `WidgetIcons/SAO.png` with provenance. Verify actual native position, stats, source pixel geometry, persistence when launcher hides and bridge ownership.
- [ ] **2. Startup.** Add `src/ui/startup.tsx`, `startup-gl.ts`, `startup.css` and native `completeStartup`/completion events. Use original Japanese voice and NerveGear/Welcome audio. Render the GPU tunnel, sensor rings and blue real-account form with offline continuation. Verify actual media playback, scene progression, real loopback login, sound/reduced-motion behavior and no replay after reload/menu invocation.
- [ ] **3. Refresh pipeline.** Add refresh-rate normalization tests (60, 120, unknown and Electron's 240fps ceiling). Replace fixed 32ms native sampling with display-driven intervals and coalesce renderer input with requestAnimationFrame. Replace isolated browser PNG frames/CPU strips with typed BGRA and WebGL mesh; preserve inverse input mapping. Update rates on display changes and window movement. Verify 120Hz target selection and real rendered browser pixels/clicks/typing; record requestAnimationFrame timing on this Mac.
- [ ] **4. Release.** Run unit, startup/HUD, hover, desktop and browser/media acceptance with disposable profiles. Bump to 0.1.2; build current app/ZIP offline, verify source equality, version, helper and ZIP integrity. Update documentation, commit changes and tag v0.1.2. Remove the preceding ZIP only after the new one verifies.

Commands: `npm test`, `npm run build`, `node scripts/smoke-startup.mjs`, `node scripts/smoke-hover.mjs`, `node scripts/smoke-desktop.mjs`, `node --import tsx scripts/smoke-surfaces.mjs`. Native tests substitute input/chooser boundaries, not rendering or authentication. Pixel and refresh acceptance must use actual Electron windows; timing is measured after shader warm-up and reported with its display frequency and dropped-frame distribution.
