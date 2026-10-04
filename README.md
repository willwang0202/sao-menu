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
- Party opens Social with friends, requests and profiles; Message opens direct conversations with accepted friends. Accounts are hosted at [sao.favioon.com](https://sao.favioon.com); see [Website and accounts](#website-and-accounts). Kirito's Windows defaults map to local folders and Finder/TextEdit/Calculator/Terminal/Console/Activity Monitor/Disk Utility.
- **Settings → Option** opens the reimplemented preferences. Its Launcher tab adds apps, folders and web links under **Navigation → Quick access**. **Settings → Exit** quits.

## Hand gestures

The launcher can also be controlled with the built-in webcam. In **Settings → Option**, under **Hand gestures**, turn on **Camera hand gestures**; macOS asks for camera access once. It is off by default, and the camera indicator stays lit while it is on.

- **Open:** hold the index and middle fingers straight with the ring and pinky curled, then swipe down. The other fingers may relax during the swipe.
- **Aim:** point with the index finger. An orange reticle starts on the menu wherever your hand is and follows your fingertip; items highlight under it.
- **Select:** push the pointing hand toward the screen. The click lands where the reticle was just before the push.
- **Close:** swipe an open hand left or right.

The mouse, shortcut and tray keep working alongside it. Place the camera centered in front of the monitor you point at: seen from the side, a forward push looks like sideways motion and clicks miss. **Camera debug view** in the same section shows the camera with hand landmarks, the detected pose and each finger's state; closing that window turns the view off.

Tracking uses [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) in a hidden, sandboxed window, about 10 fps while the launcher is closed and 30 fps while it is open. The first `npm run dev` or `npm run build` downloads the model once and checks its SHA-256; after that tracking runs offline. Only that window may use the camera, video only, and only derived gesture events leave it: no frames or hand data are recorded or stored. Thresholds and design notes are in [gesture documentation](docs/gesture.md#camera-hand-gestures) and the [hand-tracking design](docs/superpowers/specs/2026-10-03-hand-tracking-design.md).

## Link Start and HP display

A foreground launch plays Link Start as a real-time animation reconstructed from the user-selected [anime sequence](https://www.youtube.com/watch?v=cCfJvBgAd3E): rainbow tunnel, sensor checks, language and login cards, character registration, "Welcome to Sword Art Online!" and the blue dive, edge to edge across the display. Every display refresh draws a new frame (120 frames per second on a 120Hz display) instead of holding 24fps film frames. The original Japanese voice and effects play from the reference's own audio track, and the picture follows it. The empty blue login card becomes the real account form. Set an account-service URL and sign in, or continue offline; successful login resumes the entry sequence. Startup does not replay on menu invocation or renderer reload. Sound off and Reduced Motion are respected. The persistent SAO HP widget stays at the screen's top left after successful login and disappears on logout; offline continuation leaves it hidden. Its source preset reports CPU/RAM headroom rather than invented game stats.

Scene timing, positions and colours were measured frame by frame from the reference. `npm run test:startup:frames` renders the animation next to the reference at chosen times (written to `output/startup-compare/`). The reconstruction matches the reference's composition, timing and palette; fine detail is approximate, mainly dial segment layout, the soft motion blur and haze of the final blue dive, and panel font weight. [Community reference comparisons](docs/startup-references.md) cover Cad-noob, Asakitan and Akilar. On this 120Hz Mac every scene measured a median 8.3ms frame interval; this does not guarantee frame rates on all hardware.

## Website and accounts

[sao.favioon.com](https://sao.favioon.com) runs `web/`, a Next.js app on Vercel with Supabase Postgres. It serves a landing page, web sign-up and sign-in, an account page for friends and messages, and the `/v1` account API the desktop app uses. Builds from `main` default to this service. In 0.1.3, enter `https://sao.favioon.com` once in **Account service** on the login card. The site's Download button serves the public [0.1.3 release](https://github.com/willwang0202/sao-util-mac/releases/tag/v0.1.3). Architecture, infrastructure, security model and runbook: [hosted service](docs/hosted-service.md).

## Verify and package

```sh
npm test
npm run test:desktop
npm run test:hover
npm run test:surfaces
npm run test:startup
npm run test:startup:frames
npm run test:social
npm run test:hand
npm run package:mac
```

The desktop test checks actual Electron menus, sprite geometry/fonts, native launch, persistence, migration, bridge isolation and hide/reopen. The surface test checks native curved-page clicks, typed input, navigation, simultaneous PNG/GIF/video previews and dismissal channels. It needs `ffmpeg` on PATH (or `FFMPEG_PATH`) to generate a disposable video fixture. Both use temporary settings; the desktop test launches Calculator on macOS. `dist-desktop/gesture-helper --self-test` checks 23 gesture cases without injecting input; physical cross-app invocation still requires permission/session acceptance. The hand test feeds Chromium's synthetic camera through MediaPipe to the reticle without using the real webcam; gesture thresholds are unit-tested against recorded webcam frames, but real-hand accuracy still needs a person in front of the camera.

The current Apple Silicon test artifacts are `release/mac-arm64/SAO Utils 2.app` and `release/SAO Utils 2-0.1.3-arm64.zip`. Quit the running app via Exit before opening this build. `release/SAO Utils 2-0.1.3-arm64.dmg` is also built. Builds are signed with the local Developer ID certificate when one is installed, but they are not notarized, so Gatekeeper may warn on other Macs. Windows/Linux adapters and packaging scripts exist but are not runtime-verified on those systems.

Git tracks source, plans, release notes and package checksums from version 0.1.1 onward. The `v0.1.3` tag identifies this test release. Build outputs, dependencies, imported Steam assets and local account data are excluded. See [release notes](CHANGELOG.md).

`npm run dev:web` opens the same renderer in a browser with separate local-storage settings. Native launching, directory browsing, metrics, global input, tray/login behavior and file import/export require the desktop host.

See the [verification results](docs/verification.md), [implementation plan](docs/superpowers/plans/2026-10-02-sao-desktop.md), [bundle audit](docs/package-audit.md), [original design measurements](docs/original-design.md), and [compatibility](docs/compatibility.md). Original resources keep their creators' notices; the local personal build does not establish general redistribution rights.
