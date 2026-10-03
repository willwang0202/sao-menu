# Release notes

## 0.1.1 — October 3, 2026

- Root buttons and submenu rows keep their hover artwork and background during native click-through handoffs. Desktop hover uses the global cursor stream; delayed DOM movement no longer overrides it.
- Normal and hover icon faces stay loaded together. The decoded normal icon remains visible until its hover counterpart is ready.
- Launcher tilt remains active; flattening its child composition keeps button hit testing stable. Reduced Motion preserves hover tracking.
- Launcher background is transparent. macOS vibrancy and the Options backdrop blur are removed.
- Git version tracking starts with this release on `main`, tagged `v0.1.1`. Original imported assets and generated releases remain outside Git.

This baseline also includes the existing original launcher resources, curved browser, media previews, gallery, global mouse activation and initial social UI/service. Cloudflare hosting and full native social acceptance remain pending.
