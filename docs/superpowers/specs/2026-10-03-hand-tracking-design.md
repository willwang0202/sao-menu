# Webcam hand-gesture control — design

Date: 2026-10-03 · Branch: `feat/hand-tracking` · Status: approved in chat

## Intent

Control the SAO launcher with the built-in webcam, the way it works in the show:

| Gesture | Effect | Accepted when |
| --- | --- | --- |
| Index + middle extended, ring + pinky curled; swipe **down** | Summon the launcher | Menu closed |
| Index fingertip moves | Moves an SAO reticle inside the overlay; drives hover | Menu open |
| Push the pointing hand **forward** (toward the screen) | Click the item under the reticle | Menu open |
| Open hand (four fingers extended); swipe **left or right** | Dismiss the launcher | Menu open |

The feature is opt-in, macOS-first, and coexists with the mouse chord, shortcut and tray. It never moves the real
system cursor and never acts outside the SAO overlay.

## Decisions (from brainstorming)

- **Engine:** MediaPipe Hand Landmarker (`@mediapipe/tasks-vision` 1.0.1, `hand_landmarker.task` float16 v1), chosen
  for accuracy (21 landmarks with relative depth, robust to partial occlusion).
- **Host:** a hidden, sandboxed tracker `BrowserWindow` — the only web content allowed camera access. The launcher
  renderer never sees frames.
- **Cursor scope:** virtual reticle in the overlay only. No Accessibility permission.
- **Camera lifecycle:** `handTracking` setting, default **off**. When on: ~10 fps idle (summon watch), ~30 fps while
  the launcher window is visible. Off or quit releases the camera.
- **Work location:** git worktree, branch `feat/hand-tracking`, because Codex is editing the UI in the main checkout.
  Edits to shared files (`main.ts`, `main.tsx`, `contracts.ts`, `bridge.ts`, `preload.ts`, `settings.ts`) stay small
  and additive.

## Architecture

```
 webcam ──getUserMedia──▶ tracker window (hidden, tracker.html)
                           HandLandmarker.detectForVideo
                           toHandFrame → recognize() (pure)
                              │  derived events only
                              ▼  sao:tracker:event
                        main: HandTrackingController
                           validate (parseTrackerEvent)
             summon ─▶ summonAt(point)       dismiss ─▶ sao:menu:dismiss
             cursor ─▶ sao:hand:cursor       click   ─▶ sao:hand:click
                              │
                              ▼
                     overlay renderer: useHandPointer + <HandReticle>
                     feeds lastPointer/evaluatePointer (hover), element.click()
 main ─sao:tracker:config {fps, menuOpen}─▶ tracker
```

### Units

| File | Purpose | Depends on |
| --- | --- | --- |
| `src/shared/hand/landmarks.ts` | Landmark indices, `HandFrame` type, geometry helpers (distance, palm scale, aspect correction) | — |
| `src/shared/hand/pose.ts` | `classifyPose(frame) → 'summon' \| 'point' \| 'open' \| 'other'` | landmarks |
| `src/shared/hand/one-euro.ts` | Immutable One-Euro filter for 2-D points | — |
| `src/shared/hand/recognizer.ts` | Pure reducer `recognize(state, input) → { state, events }` | pose, one-euro |
| `src/shared/hand/protocol.ts` | Event/config types and `parseTrackerEvent` / `parseTrackerConfig` validators | — |
| `src/tracker/main.ts` + `tracker.html` | Camera, MediaPipe, frame loop, optional debug drawing | shared/hand, tasks-vision |
| `src/desktop/tracker-preload.ts` | Exposes `emit(event)` / `onConfig(cb)` only | protocol |
| `src/desktop/hand-tracking.ts` | `HandTrackingController`: camera permission, window lifecycle, fps mode, crash restart, event routing | protocol |
| `src/ui/hand-pointer.tsx` | `useHandPointer` hook + `<HandReticle>` | contracts |
| `scripts/prepare-hand-model.mjs` | Copies WASM from node_modules and fetches the model into `public/mediapipe/` with a pinned SHA-256 | — |

## Recognition rules

All coordinates are MediaPipe normalized image coordinates, **mirrored** (`x' = 1 − x`) so motion matches the user.
Distances are aspect-corrected (`y` scaled by height/width). Every threshold is a named constant in its module and can
be tuned against the debug view.

**Finger state** (index, middle, ring, pinky), from landmarks MCP/PIP/DIP/TIP and the wrist:
- *extended*: straightness `|MCP→TIP| / (|MCP→PIP|+|PIP→DIP|+|DIP→TIP|) ≥ 0.80` **and** `|wrist→TIP| > |wrist→PIP|`.
- *curled*: `|wrist→TIP| < |wrist→PIP|` (tip folded back past the middle knuckle).
- otherwise *neutral*.
- The thumb is ignored: its 2-D projection is the least reliable landmark chain and the four fingers already make
  each pose distinctive.

**Poses**:
- `summon`: index and middle extended, ring and pinky curled. (Fingers together or in a V are both
  accepted; the curled ring and pinky already make the pose specific, and a togetherness check would add false negatives.)
- `point`: index extended; middle, ring and pinky not extended.
- `open`: all four fingers extended.
- `other`: anything else, or no hand.

**Summon swipe** — tracked point: midpoint of index and middle tips. Keep summon-pose samples from the last
`SUMMON_WINDOW_MS = 600`. Fire when at least `SUMMON_MIN_SAMPLES = 3` exist and, against some earlier sample,
`dy ≥ 0.15` (down) and `|dx| ≤ 0.75 · dy`. The event carries the current mirrored point. Then
`GESTURE_COOLDOWN_MS = 800`.

**Dismiss swipe** — tracked point: palm centre (mean of wrist and the four MCPs). Open-pose samples from the last
`SWIPE_WINDOW_MS = 400`; fire when `|dx| ≥ 0.25` and `|dy| ≤ 0.75 · |dx|` against some earlier sample (at least 2
samples). Either direction. Then cooldown.

**Cursor** — index tip, mirrored, mapped from the active region `x ∈ [0.15, 0.85], y ∈ [0.10, 0.75]` to `[0, 1]`,
clamped, then One-Euro filtered (`minCutoff 1.2`, `beta 7`, `dCutoff 1`). Emitted for `point` and `summon` poses;
otherwise a single `cursor` with `visible: false`.

**Push click** — while pointing, keep `(t, palmScale, rawTip, cursor)` samples from the last `PUSH_WINDOW_MS = 300`.
`palmScale` = mean of the wrist–indexMCP, wrist–pinkyMCP and indexMCP–pinkyMCP distances (palm triangle; independent
of finger pose). Fire when `palmScale / min(palmScale in window) ≥ 1.12` and the raw tip moved
`≤ PUSH_MAX_DRIFT = 0.05` from that minimum sample. The click is reported at the **cursor position stored with the
minimum sample**, so forward motion cannot drag the selection. The cursor then holds at that point for
`CLICK_HOLD_MS = 250`, followed by `CLICK_COOLDOWN_MS = 500`.

Monocular webcams have no absolute depth, so palm-scale growth (≈ a 5–6 cm push at arm's length) stands in for
"forward". This is the main tuning risk; the debug view prints the live scale ratio.

**Context**: `menuOpen` comes from the main process (launcher window visible). Summon is ignored while open; cursor,
click and dismiss are ignored while closed. Losing the hand clears all sample windows.

## IPC protocol (all messages validated, bounded, finite numbers only)

Tracker → main, `sao:tracker:event` (sender must be the tracker's main frame at the tracker URL):
- `{ kind: 'status', state: 'starting' | 'running' | 'error', message?: string ≤ 300 chars }`
- `{ kind: 'summon', x, y }` — normalized `[0,1]`
- `{ kind: 'dismiss' }`
- `{ kind: 'cursor', x, y, visible }`
- `{ kind: 'click', x, y }`

Main → tracker, `sao:tracker:config`: `{ fps: 10 | 30, menuOpen: boolean }`.

Main → overlay: `sao:hand:cursor` `{ x, y, visible }` in overlay CSS pixels; `sao:hand:click` `{ x, y }`.
Overlay → main: `sao:hand:status` (invoke) → `HandTrackingStatus { supported, enabled, permission, running, message }`.

## Permissions and security

- `session.setPermissionRequestHandler` keeps denying everything except `media` with `mediaTypes` exactly `['video']`
  from the tracker `webContents`. The permission check handler mirrors this.
- macOS: `systemPreferences.getMediaAccessStatus('camera')`; `askForMediaAccess('camera')` runs only when the user
  turns the toggle on. If denied, saving the setting fails with a message pointing to System Settings → Privacy &
  Security → Camera (same pattern as an unavailable shortcut). Packaged builds add `NSCameraUsageDescription` and the
  `com.apple.security.device.camera` entitlement.
- Tracker page CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; media-src 'self' blob: mediastream:;
  connect-src 'self'; worker-src 'self' blob:; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'`.
  Model and WASM load from the app bundle only; no network at runtime.
- No frames, landmarks or history leave the tracker; nothing is persisted.

## Errors

- No camera, denied permission, model/WASM load failure → tracker posts `status: error`; controller stops the tracker,
  status shows the message, other inputs unaffected.
- Tracker renderer crash (`render-process-gone`) → restart with backoff 1 s / 3 s / 9 s, then stay stopped with a
  message.
- Invalid IPC messages are dropped and counted; the controller logs once per 100 drops.

## UI

- `<HandReticle>`: small SAO-style ring at the hand cursor, pulse on click, hidden when the hand is not pointing or
  the feature is off; `pointer-events: none`; respects reduced motion.
- Hover: the hand cursor is written into the existing `lastPointer` and `evaluatePointer` path. While the hand
  cursor is active, unchanged mouse samples from the 32 ms stream are ignored so the two inputs don't fight; a real
  mouse movement takes over immediately.
- Click: `elementFromPoint` → closest `button, a, [role="menuitem"], [data-hover-id]` → `.click()`; the existing
  click sound and handlers run.
- Preferences: "Enable hand gestures (camera)" toggle plus status line, next to the mouse-gesture status.
- Dev only: `SAO_HAND_DEBUG=1` shows the tracker window with video, skeleton, pose and push ratio.

## Testing

- Unit (TDD, `node:test`): pose classification from synthetic hands; One-Euro behaviour; recognizer — summon fires on
  a 20 % downward swipe, not on upward/diagonal/slow motion, not while open; dismiss both directions; push click fires
  at the frozen cursor, not when the tip drifts, honours cooldown; losing the hand resets; protocol validators reject
  malformed, oversized and non-finite messages.
- Integration: settings normalization of `handTracking`; permission handler predicate.
- E2E smoke: `scripts/smoke-hand.mjs` launches the tracker with Chromium's fake camera
  (`--use-fake-device-for-media-stream`) to verify camera → MediaPipe → `status: running` end-to-end.
- Manual checklist on the real webcam (in the plan).

## Out of scope

Windows/Linux packaging specifics (code is portable; only macOS permission flow is implemented), real-cursor control,
drag/scroll gestures, two-hand gestures, calibration UI.
