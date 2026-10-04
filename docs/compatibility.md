# Current compatibility

This build targets the supplied Steam SAO launcher with original local resources and a reimplemented Electron host. The inspected sprite dimensions, hierarchy and font/SFX references guide the renderer; this does not establish full original application parity.

## Implemented and incomplete

| Area | Current behavior |
| --- | --- |
| Launcher presentation | Original sprites, masks, panel images, fonts and sounds; cascading hierarchy; expanded surfaces follow the selected category while the rail stays fixed; explicit scroll/drag moves the rail |
| Original menu XML | Retains 32 supplied nodes and 8 URLs; maps 11 known Windows actions declaratively; Option/Exit become preferences/quit |
| Native macOS targets | Local document/media directories, Finder, TextEdit, Calculator, Terminal, Console, Activity Monitor and Disk Utility |
| Social / direct messages | Party opens friends, requests, profiles and persisted six-player parties; Message opens accepted-friend conversations. Standalone account identities, sessions and message history are implemented and hosted at sao-menu.favioon.com (Vercel + Supabase; see [hosted service](hosted-service.md)). Full native UI acceptance against the hosted service is pending |
| Preferences | Reimplemented Options/Launcher/About controls; the original compiled preference editor is unavailable as source |
| Browser | Actual isolated Chromium pages, original artwork, whole-frame curvature, inverse click mapping, typing, scrolling, history, reload/stop and address editing in separate floating windows |
| Media previews | Separate image/GIF and looping-video windows; filename title, original external-viewer glyph, Fit/Crop, auto/reset sizing, mute, pause/resume and Change Image/Video chooser |
| Cursor and background | Global cursor-responsive launcher/preview tilt; transparent launcher background without desktop blur; curvature and tilt parameters reconstructed from the publisher's demonstrations |
| Dismissal | Outside click and upward two-button slide animate/hide the launcher; independent previews remain visible |
| Gallery and saved previews | Original 18 GLSL transitions, Fit/Crop, frames, shuffle, pause/resume, wheel navigation, refresh, media drag/drop and persisted native preview sources/bounds/options |
| HP and remaining widgets | Persistent original SAO HP artwork with account display names, battery percentage (100% without a battery) and accepted party-member bars. HP is hidden before login and after logout. Clock/HUD presets and the complete widget host remain unimplemented |
| Original runtime/extensions | No original QML host, DLL plug-ins, ADV server, Steam Workshop/achievements, mail, weather, media controls or advanced sensor runtime |

The supplied Help entry has no assigned action. Arbitrary imported commands stay unsupported. The host validates paths and HTTP(S) URLs; it does not evaluate original shell/script text. Local data-file browsing rejects executable/script/installer/shortcut formats.

## Platforms and native behavior

macOS is the local development host. Native CI packaged, verified and launched 0.1.6 on Mac arm64/x64, Windows x64 and Linux x64; physical OS integration and installer acceptance still need real devices; Linux application launching requires `gio`. Battery reporting is implemented for macOS, Windows and Linux where available, defaulting to 100% without telemetry. The browser renders menus/resources and allows web links/local preferences, but provides no native applications, folders, telemetry, global input, tray, login launch or import/export choosers.

The default shortcut is **Option+S / Alt+S**. macOS's Swift/CoreGraphics helper passively observes both mouse buttons and a downward slide. Enable the app/helper in **Privacy & Security → Input Monitoring**. It observes no keyboard events and suppresses no pointer events. Its 64-point threshold is a port choice; the original compiled threshold is unknown. Two-finger touch and Windows/Linux global mouse gestures remain unimplemented.

The launcher uses a transparent window covering the invoking monitor's work area, visible across Spaces, without macOS vibrancy or a background blur filter. Transparent space passes mouse clicks to underlying apps on macOS/Windows; source controls remain interactive. Hover and click-through use the same native cursor position, avoiding state changes from forwarded mouseleave or stale DOM movement. Linux has no forwarded-hover adapter. Independent browser/media windows float above other apps. Original compositor positioning/edge accommodation, exact curvature/tilt, monitor/Spaces acceptance and full transition equivalence remain parity work. Closing hides the app for tray access; packaged macOS/Windows login launch starts hidden. Linux startup is managed by the desktop environment.

Browser pages receive no local preload, Node access or desktop IPC. They have a separate persistent browsing partition and cannot navigate to local file/custom schemes. Media previews use ephemeral tokens for native-selected passive files, with byte-range streaming and revocation on replacement/close. Video codecs, protected/DRM video, IME/clipboard input, downloads and browser permission-dependent features are not established as equivalent to the original CEF engine. Exact frame content insets and complete original widget behavior remain parity work.

## Resources and storage

`npm run import:assets -- "/path/to/SAO Utils 2"` copies the original theme resources and notices into gitignored `public/sao-original/`. Python `fontTools` extracts the original Source Han Sans collection face as a Chromium-readable OTF. The importer also reads the original app icon as image data from the executable's resource directory. Builds require the imported resources and verify hashes of the core assets. Original resource notices and hashes are retained; local personal use does not grant redistribution rights.

Electron stores `settings.json` and locally selected application permissions in its `userData` directory. Export includes settings, not device permissions. Imports are bounded to 2 MB, 200 favorites and menu depth/entry limits; XML declarations/entities are rejected while standard escapes are decoded. JSON imports retain device-specific login/hotkey/topmost settings and reject foreign native targets. Browser settings use separate origin local storage.

## Verification boundary

`npm test` passes 102 configuration/menu/surface/account/party/battery/gesture cases. `npm run test:desktop` uses actual Electron with temporary settings: original assets/fonts/geometry, fixed rail positions and menu anchoring when switching Kirito/Settings, cascading menus, Calculator launch, persistence, XML/JSON migration, pointer passthrough, IPC isolation and animated hotkey dismissal/hide/reopen. `npm run test:surfaces` checks real page painting, curved clicks, typed input, history, simultaneous PNG/GIF/looping WebM previews, pause/resume, cursor updates and outside/swipe dismissal channels. Only native file choosers are substituted. Gesture `--self-test` runs 23 checks without injecting events; physical global delivery needs macOS permission and a real session.

The desktop app keeps the product name **SAO Utils 2**. Apple Silicon packages are Developer ID signed, Intel Mac packages use ad-hoc CI signing, and Windows packages are unsigned. Mac notarization and physical-device installer acceptance remain incomplete; packaged runtime launch checks passed on all four native targets. See [original-design.md](original-design.md) for source measurements and [package-audit.md](package-audit.md) for inspected binary/source boundaries.
