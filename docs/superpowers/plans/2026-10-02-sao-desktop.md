# SAO Utils 2 Port Implementation Plan

**Goal:** Mirror the original SAO Utils 2 launcher design and documented interactions on macOS, with a shared interface and Windows/Linux adapters.

**Architecture:** React renders the original menus; a narrowly scoped preload bridge calls an Electron host. Shared TypeScript owns the configuration format and data-only migration. Native APIs live behind `DesktopAPI`, so another shell can reuse the interface and configuration format.

**Tech stack:** TypeScript, React, Vite, Electron, esbuild, electron-builder, Node test runner, fast-xml-parser.

## Scope and choices

The supplied installation is a Windows runtime distribution. Its Qt/QML themes depend on NERvGear and private native modules; it does not provide the host source needed for a direct macOS rebuild. The presentation target is the exact original SAO theme: preserve its sprites, font, sound files, hierarchy, dimensions and observable menu interactions. Local resources and original notices are imported from the user's installation into gitignored `public/sao-original`. The native host is reimplemented without executing Windows binaries or importing proprietary QML modules.

Electron is the first host because it provides windows, a tray, shortcuts and platform launching in one runtime. A Qt rewrite would require rebuilding the unavailable host APIs. A separate SwiftUI macOS implementation would duplicate the interface and leave Windows/Linux for separate projects. The shared bridge keeps a future Swift/Tauri/Qt host possible without promising that every OS or stack exposes the same desktop functions.

The implementation uses the original five categories, 64-pixel root buttons, 182×310-pixel submenu columns, 46-pixel ribbons, 270-pixel information panel, raster states, masks, typography and measured transition durations. Category selection keeps buttons stationary and moves expanded surfaces to their position, matching the user's reference behavior; explicit wheel/drag scrolling moves the rail. Nested selections move to the column center and open another column. The first category opens after the entrance stagger. Alt+S/Option+S and the macOS two-button downward gesture are implemented. The 64-point gesture threshold is a port choice because the original compiled constant is unknown.

The XML importer preserves hierarchy, maps recognized commands to native equivalents and retains unsupported commands as data. It preserves 32 nodes and 8 URLs, with 11 mapping notices. Native application/folder browsing, launchers, persistence, tray and login controls are implemented. Preferences remain compatibility controls; original compiled preferences, widgets, plug-ins and Steam services are incomplete. Substitute clock/notes/HP widgets, alternate accents, procedural icons and previous builds have been removed. The current Dock/tray icon uses original image-resource bytes.

## Implementation tasks

- [x] Audit the supplied package read-only and record native/source/configuration boundaries in `docs/package-audit.md`.
- [x] Define `src/shared/contracts.ts` as the interface shared by the renderer and desktop host.
- [x] Scaffold build scripts, strict TypeScript and a local-only content security policy.
- [x] Implement normalization, launcher validation, bounded JSON/XML imports and a browser adapter in `src/shared/settings.ts` and `src/shared/bridge.ts`.
- [x] Test corrupted preferences, prohibited URL protocols, cross-platform path migration, XML entities, nesting and duplicates in `tests/settings.test.ts`.
- [x] Implement and review `src/desktop/main.ts`, `preload.ts`, application adapters and system telemetry. Use `execFile`/argument arrays rather than shell command interpolation; verify all IPC originates in the app window.
- [x] Import original resources and measure QML into `docs/original-design.md` and `resources/original-manifest.json`.
- [x] Implement `src/ui/main.tsx` and its styles around the original raster states, geometry, hierarchy and timings.
- [x] Implement the universal Swift gesture helper and verify its 23 state-machine checks.
- [x] Run configuration/menu tests and production builds; resolve contract/type/bundling errors.
- [x] Exercise the actual Electron window: source geometry/fonts, cascading menus, native launch, persistence, import/export, hide/reopen and bridge isolation. Verify browser cascades and no-action Help. Physical gesture/shortcut acceptance remains separate.
- [x] Build the current macOS app/DMG with automatic signing disabled; compare packaged files with current sources and check the actual packaged UI.
- [x] Add user setup, migration, packaging and compatibility documentation, with reproducible checks.

## Verification commands

```sh
npm install
npm run import:assets -- "/path/to/SAO Utils 2"
npm test
npm run build
npm run test:desktop
npm run test:surfaces
npm start
npm run package:mac
```

`npm test` must report all configuration/migration tests passing. `npm run build` requires imported resources, checks hashes, type checks and produces `dist`/`dist-desktop`. Native verification uses `window.sao` through preload and confirms actual filesystem/OS adapters. Package builds produce `release/mac-arm64/SAO Utils 2.app` on this Apple Silicon host. Signing and notarization are separate distribution work; local builds disable automatic signing-identity selection.

Windows/Linux packaging commands exist, but execution and acceptance must run on those systems. CI validates TypeScript, native-host builds and tests on macOS, Windows and Ubuntu; it does not redistribute the user's Steam resources. Full local renderer/packages require resource import. Web/mobile use the portable interface without arbitrary native launching/global input.

## Browser, previews and dismissal extension

Reference: [publisher's demonstration supplied by the user](https://www.youtube.com/watch?v=82yPo7IMMAk), the channel's [early launcher/widget preview](https://www.youtube.com/watch?v=fNdbu9Mxd0c), original system browser images, and readable ImageWidget/VideoWidget QML. Numeric compositor values remain reconstructed because the browser/cursor implementation is compiled.

- [x] Import original browser/control/media artwork and Font Awesome Regular; preserve resource hashes/notices.
- [x] Add independent sandboxed native surfaces and a distinct owner-checked surface preload.
- [x] Render actual offscreen Chromium pages with the original curved frame and inverse pointer mapping; support typing, scroll, history, address, reload/stop and web popups.
- [x] Implement multiple local image/GIF and looping video previews, native file streaming, auto/reset sizing, Fit/Crop, Mute, Change Image/Video, external viewer and pause/resume.
- [x] Poll the global cursor for perspective and hover; use transparent full-work-area launcher placement. Desktop blur was removed at the user's request in 0.1.1.
- [x] Forward global outside clicks and upward two-button gestures into the original exit animation; leave independent previews visible.
- [x] Verify actual Electron page clicks/typing/history, simultaneous PNG/GIF/WebM, playback and dismissal channels with an isolated profile.
- [x] Verify physical summon/dismiss in another app: the user confirmed downward invocation, outside-click dismissal and upward dismissal; the packaged listener reports granted/active.
- [ ] Match the original host's exact curvature, perspective, gesture thresholds and complete preference editor.
- [ ] Implement original media drag/drop, gallery slideshow and persisted widget layout.

## Further parity work

1. **Original host compatibility:** obtain appropriate source access/permissions, define the NERvGear API surface, and replace native plug-in dependencies before attempting original QML execution.
2. **Desktop overlay behavior:** implement original widgets in independent native windows, persist monitor placement, and verify exact edge accommodation and Spaces/Wayland behavior.
3. **Portable extension API:** define declarative widget/action manifests, permissions, isolated rendering, resource budgets and version negotiation. Original native DLLs cannot be loaded across operating systems.
4. **Media and sensors:** implement system media controls and platform telemetry separately; unsupported values must remain unavailable instead of simulated.
5. **Workshop and richer content:** implement authenticated Steam integration and imported-resource licensing separately, with failure/offline behavior and migration tests.
6. **Distribution:** signed/notarized macOS releases, Windows signing, platform installation tests and a reviewed update channel.

These remain open requirements for the user's complete original-parity target. The current artifacts implement the launcher, browser and media interactions described above; they do not complete that target.
