# SAO Utils 2 — macOS port

The current build ports the Steam package's SAO launcher using its original local images, sounds, fonts and menu hierarchy. It includes a curved, interactive web browser and independent image/GIF/video previews with cursor-responsive perspective. Its native host is reimplemented in Electron; original Windows executables and DLLs are not loaded. Full original parity remains incomplete: see [compatibility](docs/compatibility.md) for the preferences, widget and plug-in gaps.

## Setup and run

Requirements: Node.js 22.12+, Python 3 with `fontTools`, and macOS Xcode Command Line Tools (`xcrun`/Swift) for the global mouse helper. The font importer extracts an OTF face from the supplied Source Han Sans collection so Chromium can render the original CJK glyphs.

```sh
npm install
python3 -m pip install fonttools
npm run import:assets -- "/path/to/SAO Utils 2"
npm run dev
```

Use your own Steam installation's current path. Imported images, audio, fonts, menu XML and original notices stay in gitignored `public/sao-original/`, with a generated provenance manifest. This workspace already retains imported resources; a fresh checkout needs that import. If font extraction warns, install `fontTools` into the Python environment used by `python3` and reimport.

For the production desktop build:

```sh
npm run build
npm start
```

Quit an existing instance before starting another build. Renderer changes reload during `dev`; restart after native host/preload changes.

## Original menu controls

- **Option+S** on macOS (**Alt+S** elsewhere) toggles the launcher. The tray icon opens, hides or quits it.
- On macOS, hold both mouse buttons and slide down to summon from another app. In **Settings → Option**, choose **Enable mouse gesture**, then grant the app/helper **Input Monitoring** in macOS Privacy & Security. The port uses a 64-point threshold; the original compiled threshold is unknown.
- Click outside to dismiss. Holding both buttons and sliding upward also dismisses with the original launcher exit animation. Observing clicks outside the app requires Input Monitoring too.
- The circular categories retain **Kirito**, **Party**, **Message**, **Navigation** and **Settings**. Selecting a category keeps the buttons in place and moves expanded surfaces alongside it. Scroll/drag stacks to browse. Arrow keys navigate; **Esc** goes back or hides.
- Party opens Social with friends, requests and profiles; Message opens direct conversations with accepted friends. The online account service is not deployed yet; favioon.com on the user’s Cloudflare account is the selected destination. Kirito's Windows defaults map to local folders and Finder/TextEdit/Calculator/Terminal/Console/Activity Monitor/Disk Utility.
- **Settings → Option** opens the reimplemented preferences. Its Launcher tab adds apps, folders and web links under **Navigation → Quick access**. **Settings → Exit** quits.

## Browser and media

Navigation links open in the built-in browser. **Settings → Option → Web Browser**, the tray, and the native **File** menu also open a browser. Its original tab, close, reload/stop and address artwork curve with the actual page. Click, type and scroll normally; **Command/Control+L** changes the address. Right-click for history, reload and opening in your default browser. Remote pages run in an isolated process without the local desktop bridge.

Choose **Images / Video** in Options, or **File → Preview images and videos**, and select one or several local files. Browsing media through the launcher opens the same previews. Images, animated GIFs and looping videos stay visible when the launcher hides. Right-click for Fit/Crop, Auto Resize, Reset Size, Change Image/Video, Mute and Close. Click a video to pause/resume; the title's external-viewer icon opens the selected file in its default application. Supported extensions include PNG/JPEG/GIF/WebP/AVIF/BMP and MP4/WebM/M4V/MOV/OGV; actual video codecs depend on Electron.

Cursor movement changes launcher and preview perspective even outside their windows. The launcher background stays transparent, with no desktop blur. Original numeric compositor settings are unavailable in the supplied compiled host; the current curvature and perspective are reconstructed from the [publisher's video](https://www.youtube.com/watch?v=82yPo7IMMAk), not proven identical shader parameters. The anime clips in that demonstration are not bundled media.

Use **File → Gallery Widget** for an image folder with all 18 original GLSL transitions. Click to pause/resume and scroll to change images; right-click for settings and original frames. Drag local media onto the launcher to open previews, or onto a preview to replace its source. Preview sources, bounds and presentation settings survive an app restart; closing a preview removes its saved entry.

## Configuration

The resource importer supplies `Configs/system/launcher/menu.xml` for first-run initialization. To replace the hierarchy later, choose **Settings → Option → Import** and select that XML or an exported JSON backup. The supplied XML retains 32 menu nodes and 8 web links, with 11 notices for recognized Windows actions mapped to native equivalents. Unknown commands stay unsupported; importing never executes command strings.

Export writes version 1 JSON containing menus and portable settings. JSON import keeps the current device's login, hotkey and always-on-top preferences; application locations selected outside normal discovery roots must be authorized again with the picker. Settings stay in Electron's local user-data directory.

## Verify and package

```sh
npm test
npm run test:desktop
npm run test:hover
npm run test:surfaces
npm run package:mac
```

The desktop test checks actual Electron menus, sprite geometry/fonts, native launch, persistence, migration, bridge isolation and hide/reopen. The surface test checks native curved-page clicks, typed input, navigation, simultaneous PNG/GIF/video previews and dismissal channels. It needs `ffmpeg` on PATH (or `FFMPEG_PATH`) to generate a disposable video fixture. Both use temporary settings; the desktop test launches Calculator on macOS. `dist-desktop/gesture-helper --self-test` checks 23 gesture cases without injecting input; physical cross-app invocation still requires permission/session acceptance.

The current Apple Silicon test artifacts are `release/mac-arm64/SAO Utils 2.app` and `release/SAO Utils 2-0.1.1-arm64.zip`. Quit the running app via Exit before opening this build. DMG creation could not access a disk image device in the sandbox. Local builds are unsigned and not notarized. Windows/Linux adapters and packaging scripts exist but are not runtime-verified on those systems.

Git tracks source, plans, release notes and package checksums from version 0.1.1 onward. The `v0.1.1` tag identifies this test release. Build outputs, dependencies, imported Steam assets and local account data are excluded. See [release notes](CHANGELOG.md).

`npm run dev:web` opens the same renderer in a browser with separate local-storage settings. Native launching, directory browsing, metrics, global input, tray/login behavior and file import/export require the desktop host.

See the [verification results](docs/verification.md), [implementation plan](docs/superpowers/plans/2026-10-02-sao-desktop.md), [bundle audit](docs/package-audit.md), [original design measurements](docs/original-design.md), and [compatibility](docs/compatibility.md). Original resources keep their creators' notices; the local personal build does not establish general redistribution rights.
