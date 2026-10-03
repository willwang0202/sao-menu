# Original media and social behavior implementation plan

**Goal:** Add source-based gallery/drag-drop/layout behavior and give Party/Message the social and direct-message roles explicitly requested by the user.

**Architecture:** The existing owner-checked native bridges remain the boundary. Surface state owns media presentation and persists only canonical sources and native bounds, never stream tokens. Gallery rendering adapts the bundled GLSL unchanged. A separate social host and bridge own peer connections and conversation storage; UI uses the original rail and ribbon assets.

**Tech stack:** TypeScript, React, Electron, WebGL, Node test runner and native Electron Playwright integration checks.

## Decisions and evidence

- Source: `Packages/com.gpbeta.media/qml/{GalleryWidget,GalleryDialog,ImageWidget,VideoWidget}.qml`, `qml/shared.js`, and the 18 bundled `Shaders/gl-transitions/*.glsl` files.
- Gallery defaults are Crop, transparent, random transition, 1000 ms animation + 5000 ms still; folder entries are JPG/JPEG/PNG/WebP, nonrecursive, alphabetically ordered. The shipped preset chooses Fit and a compact-white frame. Click toggles and wheel advances/reverses, including while paused.
- Image/Video drop replaces the first URL. Native selection and drop revalidate canonical passive files and revoke replaced tokens. Main-window drops may create multiple separate previews.
- Party and Message in the supplied menu XML map to Start Menu/Desktop folders. The user's latest instruction replaces these default semantics with friends/social and direct messages; custom application shortcuts remain accessible through Navigation/Options.
- The user selected online accounts for friends on different networks and authorized Cloudflare hosting at favioon.com. Build the service and native UI before deployment. The subsequent instruction prioritizes a test release before further implementation.
- The user requested Git version tracking on October 3. Source, plans and package verification are tracked on `main`, starting with the 0.1.1 release. Imported assets, release binaries and local account data remain excluded.

## Tasks

- [x] **1. Surface state and persistence.** Add `MediaPresentation`, `GallerySettings` and `SurfaceLayout` validation. Test rejected schemes, invalid media types, malformed bounds/options, 12-window limit and removed files. Use serialized atomic `surface-layout.json` writes; restore only sources that pass current validation; closing removes the entry, quitting preserves it.
- [x] **2. Drag/drop and gallery host.** Add preload `dropFiles(files: File[]): Promise<void>` using Electron `webUtils.getPathForFile` and exact owner channels. Main drop opens media; media drop replaces same-kind first file; gallery drop picks a folder. Add native folder chooser and bounded nonrecursive JPG/JPEG/PNG/WebP enumeration. Tokenize each gallery image, revoke on refresh/close. Expose gallery settings and presentation updates through validated surface IPC.
- [x] **3. Source gallery renderer.** Import the 18 shader files and original notices/hashes. Build WebGL source sampling with the original Fit/Crop remapping and chosen GLSL; use a linear 1000 ms progress and 5000 ms hold by default. Add source settings, original frames, click pause/resume and wheel navigation; keep context loss/decoding failures visible. Verify real shader compilation and image changes in Electron.
- [ ] **4. Social semantics and connections.** Override the two default roots without altering original symbols. Render Friends/Requests and direct conversation lists; enable online accounts and friend requests, messages, unread counts, accepted-friend boundaries and durable history according to the selected connection model. Test real two-peer messaging and rejected unpaired/invalid input; no invented contacts or messages.
- [ ] **5. Native acceptance and current package.** Run `npm test`, `npm run test:desktop`, `npm run test:surfaces` and extended media/social checks with isolated profiles. Build the single current macOS app/DMG, verify packaged source/icon/helper equality, update original measurements/compatibility/verification docs. Exact compositor, full original preferences and other plug-ins remain separate open requirements.

## Verification interfaces

```ts
interface MediaPresentation { fill: 'contain' | 'cover'; muted: boolean; autoResize: boolean }
interface GallerySettings { fill: 'contain' | 'cover'; fillColor: string; frame: string; frameAbove: boolean; shuffle: boolean; transition: string; animateTime: number; stillTime: number }
interface SurfaceLayout { kind: 'browser' | 'image' | 'video' | 'gallery'; source: string; bounds: { x: number; y: number; width: number; height: number }; presentation: MediaPresentation; gallery?: GallerySettings }
```

Native tests assert actual rendered pixels/shader compilation, real streaming, source replacement, revocation, pause/resume, settings/bounds surviving restart and removal on explicit close. Network tests use actual loopback peers and temporary histories, with no external recipients.

## Current progress — October 3 test release

Tasks 1–3: complete. All 18 shaders compiled and rendered in native Electron; drop/replacement/revocation and saved bounds/options passed. Task 4: standalone account service unit tests pass; native UI is implemented but full two-account acceptance is pending. The initial native social test exposed an asynchronous predicate polling error in the test harness; repair that before rerunning. No public service is deployed.

The user's release feedback takes priority: 0.1.1 stabilizes root/submenu hover through native window handoffs, stale DOM movement, delayed icon decoding and Reduced Motion. macOS vibrancy and the dialog backdrop blur are removed. Native hover/transparency and desktop baseline checks pass. Git tracks the release source and checksums; see the current verification record for packaging results. Task 5 remains open for social and remaining parity acceptance.
