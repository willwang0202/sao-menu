# Release notes

## Unreleased

## 0.1.5 — October 3, 2026

- Pin the production account service to sao-menu.favioon.com; remove address controls and allow account creation from the animated launch screen.
- Use the account display name in the menu and HP widget. HP now represents battery percentage on macOS, Windows and Linux, with 100% when no battery is present.
- Add persisted online parties: friend invitations, acceptance/decline and leave, six-member capacity, leader succession, and battery presence visible only to party members. Companion HP bars appear only after party acceptance.
- Fix Windows resource archive restoration, Linux DEB maintainer metadata and installer architecture names, and isolated packaged-app launch checks.

## 0.1.4 — unpublished build preparation

- Rename the project and GitHub repository to `sao-menu`, and the website to SAO Menu at `sao-menu.favioon.com`. The old account-service hostname remains available for existing installations.
- Use the hosted account service by default, carrying forward the shared SQLite/Postgres protocol, friends, presence and direct messages.
- Add native release builds for Apple Silicon and Intel macOS, Windows x64 (installer and ZIP), and Linux x64 (AppImage and DEB). Tagged builds restore a checksum-verified resource bundle, run the test suite and launch the packaged app before uploading installers.
- Add platform download links, a Support page and a structured GitHub bug report form. Reporting requires a GitHub login.
- Retain the merged webcam hand-gesture controls, real-time Link Start, login-gated HP display, transparent menu and persisted browser FOV.

### Hosted service work included since 0.1.3

- Host the account service at https://sao.favioon.com: Next.js on Vercel (`web/`) with Supabase Postgres, provisioned through the Vercel Marketplace. The domain's DNS is in Cloudflare. The desktop app's `/v1` protocol is unchanged.
- Add an SAO-styled website: a landing page with the real-time Link Start tunnel, Link Start–card sign-up and sign-in, and an account page with friends, requests and messages.
- Split the account service into a shared protocol core behind an `AccountStore` repository, with SQLite (local) and Postgres (hosted) stores. The account tables live in a private `sao` schema with RLS on and no API-role grants. Rate limits are shared across serverless instances.
- The desktop app defaults to the hosted service.
- Publish the 0.1.3 DMG and ZIP as a public GitHub Release; the site's Download button links to it.

## 0.1.3 — October 3, 2026

- Replace the Link Start video with a real-time reconstruction drawn every display refresh: rainbow tunnel, five sensor dials, language/login/registration cards, welcome text and blue dive, timed frame by frame to the reference. The reference's audio track (stream-copied, not re-encoded) supplies the voice and effects, and the picture follows it.
- Add `scripts/compare-startup.mjs` for side-by-side checks against the reference clip, which stays in test fixtures and is no longer bundled.
- The startup smoke test now reports frame timing per scene, checks a new frame is drawn every refresh, and compares launch bounds against the display the window opened on.

## 0.1.2 — October 3, 2026

- Use the user's selected 1080p anime Link Start source, original Japanese voice/effects, sensor checks and animated login/entry transitions. Startup covers the entire native display with no outer borders; the previous Integral Factor movie and low-resolution login still are removed.
- Align real account fields with the source login card, pause for authentication, resume entry after success, and support offline continuation, sound off and Reduced Motion. HP stays hidden before login and after logout.
- Add the original SAO HP widget anchored at the top left, with live CPU/RAM headroom and original 500ms bar/count animation.
- Follow monitor refresh for cursor sampling and isolated browser painting. GPU mesh rendering and bounded raw BGRA delivery replace CPU curvature and PNG/base64 streaming.
- Add a live 20°–100° browser FOV control with aligned input, a 45° reset and restart persistence.
- Compare Cad-noob, Asakitan and Akilar's community recreations with the selected source; document their sequence differences.
- Verify real local two-account registration, friendship, direct messages, unread/read state, encrypted credential restoration and logout. Public Cloudflare hosting remains pending.
- Include the independently merged webcam hand-gesture controls. Camera tracking remains opt-in.

## 0.1.1 — October 3, 2026

- Root buttons and submenu rows keep their hover artwork and background during native click-through handoffs. Desktop hover uses the global cursor stream; delayed DOM movement no longer overrides it.
- Normal and hover icon faces stay loaded together. The decoded normal icon remains visible until its hover counterpart is ready.
- Launcher tilt remains active; flattening its child composition keeps button hit testing stable. Reduced Motion preserves hover tracking.
- Launcher background is transparent. macOS vibrancy and the Options backdrop blur are removed.
- Git version tracking starts with this release on `main`, tagged `v0.1.1`. Original imported assets and generated releases remain outside Git.

This baseline also includes the existing original launcher resources, curved browser, media previews, gallery, global mouse activation and initial social UI/service. Cloudflare hosting and full native social acceptance remain pending.
