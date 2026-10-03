# Launcher activation

The supplied `Configs/system/hotkey.xml` stores `134217811` for `toggle-launcher`. This is Qt's `AltModifier` (`0x08000000`) plus `Key_S` (`0x53`), so the port defaults to **Alt+S**, displayed as **Option+S** on macOS. This mapping comes from the [Qt keyboard constants](https://doc.qt.io/qt-6/qt.html). Existing saved shortcuts remain configurable.

The developer's [Steam description](https://store.steampowered.com/app/877280/SAO_Utils_2_Progressive/) specifies holding the left and right mouse buttons together and sliding down anywhere to summon the launcher. It also describes a two-finger gesture on touch tablets. The supplied readable configuration does not specify the original native gesture threshold.

On macOS the port uses a small Swift helper with a passive Core Graphics event tap. Hold both mouse buttons and move downward by at least 64 screen points, keeping the movement mostly vertical. Moving upward by the same amount dismisses the launcher. It triggers once per button chord; releasing either button resets it. The invocation chord and direction match the original mechanism; the 64-point threshold and upward dismissal are port choices because the original Windows core is not supplied as source.

Choose **Enable mouse gesture** in preferences to request macOS **Input Monitoring** permission. In System Settings → Privacy & Security → Input Monitoring, authorize SAO Utils 2 or its gesture helper if listed. Restart if macOS requests it. Checking status and starting the app never request permission. The configured shortcut and tray continue to work without this permission. Apple documents the passive event-tap approach in its [Input Monitoring guidance](https://developer.apple.com/forums/thread/811443).

The helper observes only left/right button and pointer-motion events, with no keyboard-event subscription, event suppression, or pointer-history storage. It emits listener status, summon, dismiss and pointer-down events. The native process launches it using fixed arguments and validates bounded messages; the renderer cannot submit commands or executable paths to it. Permission status refreshes in the background; granting permission can start the listener without another request. Choosing Enable opens the Input Monitoring pane if macOS still reports denial; the user controls the actual grant.

Summoning chooses the monitor nearest the pointer, fills its available work area, and sends the renderer a pointer anchor with margins for the launcher columns. The launcher uses the original theme's offset around that anchor and leaves the desktop background transparent. Pointer coordinates sampled at 32 ms intervals drive perspective, hover and click-through; these samples are not retained. Reduced Motion disables tilt while keeping the cursor stream active for hover.

On macOS/Windows the renderer checks which controls are under the pointer and the native host passes clicks through transparent space. The host uses Electron's [forwarded mouse-move API](https://www.electronjs.org/docs/latest/api/browser-window#winsetignoremouseeventsignore-options), while retaining input for buttons, menus, panels, dialogs and active dragging. Linux's adapter currently keeps the window interactive.

Outside pointer-down events are compared with current control bounds, including their perspective transforms. An outside click starts the source's 400 ms dismissal and hides the native window afterward. Preferences ignore global outside dismissal while their dialog is open. Independent media/browser previews remain visible after the launcher hides.

The global mouse gesture currently requires macOS. Windows and Linux use the configurable shortcut and tray. The web preview recognizes the same chord only within its tab. The original touch-tablet gesture has no macOS trackpad equivalent in this implementation; ordinary two-finger scrolling is preserved.

`src/desktop/gesture-build.mjs` compiles a universal arm64/x86_64 helper using the installed Xcode command-line tools. It is packaged outside Electron's `asar` as `Resources/gesture-helper`. Run `dist-desktop/gesture-helper --self-test` to verify gesture recognition without requesting permission or observing live input.

# Camera hand gestures

Turn on **Camera hand gestures** in Preferences → Options to control the launcher with the built-in webcam. It is off by default. Turning it on asks macOS for camera access once, and the camera indicator stays lit while it is on.

| Gesture | Effect |
| --- | --- |
| Index and middle fingers straight, ring and pinky curled; swipe **down** | Open the launcher near where the fingers end |
| Point with the index finger | Move the orange reticle; menu items highlight under it |
| Push the pointing hand **forward** toward the screen | Select the item under the reticle |
| Open hand (four fingers straight); swipe **left or right** | Close the launcher |

A hidden, sandboxed tracker window runs MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`, float16 model v1) at about 10 fps while the launcher is closed and 30 fps while it is open. The WASM runtime and model ship inside the app (`scripts/prepare-hand-model.mjs` verifies the model's SHA-256), so tracking works offline. Only that window may open the camera, and only for video. The launcher renderer and every other page remain denied. Frames and landmarks never leave the tracker. The main process receives only validated gesture events, and nothing is recorded or stored.

Fast swipes blur, so the middle frames often lose the hand. Swipes are therefore judged from their start and end frames within a short window (800 ms to summon, 600 ms to dismiss), and frames without a hand in between are ignored. A single webcam cannot measure absolute depth, so "push forward" is recognized as the palm growing at least 12% larger within 300 ms while the fingertip stays put. The selection uses the reticle position from just before the push, so the push cannot drag it onto a neighbouring item. All thresholds are named constants in `src/shared/hand/recognizer.ts` and `src/shared/hand/pose.ts`.

For tuning, run `SAO_HAND_DEBUG=1 npm run dev`. The tracker window becomes visible, showing the mirrored camera, landmarks, the current pose, the palm scale and the last gesture. `npm run test:hand` runs an end-to-end check against Chromium's synthetic camera. It verifies the camera → MediaPipe → IPC pipeline, that the launcher renderer cannot open the camera, and that the reticle hovers and clicks.

## Manual checklist (real webcam)

- [ ] Enabling the toggle shows the macOS camera prompt once, and the status reads "Camera tracking active".
- [ ] With the launcher closed, a two-finger swipe down opens it. A one-finger or open-hand swipe down does not.
- [ ] Pointing moves the reticle smoothly across the full launcher, and items highlight under it.
- [ ] A forward push selects the highlighted item without jumping to a neighbour. Resting the hand does not click.
- [ ] An open-hand swipe left and right each close the launcher. Slow sideways drift does not.
- [ ] Moving the real mouse takes over hover immediately, and the mouse chord and shortcut still work.
- [ ] Turning the toggle off turns the camera indicator off.
