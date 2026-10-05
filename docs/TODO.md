# Port backlog

Working list for the SAO Utils 2 port. Scope decisions (keep/drop) were made with the user on 2026-10-04; anything from the original packages not listed here needs the user's decision before porting.

Merged into `main`; released in 0.1.8 (themes, widgets) and 0.1.10 (Field Map, rename).

## Shared scaffold
- [x] `Settings.theme` (`sao` | `alo` | `ggo`), validated in `normalizeSettings`, default `sao`
- [x] `src/shared/themes.ts`: theme names and `themeSound(theme, event)` with SAO fallback
- [x] Launcher sounds go through `themeSound`; `data-theme` on `.sao-desktop`
- [x] Theme selector in Settings → Option → Interface
- [x] Importer copies GGO theme images/presets, HP-bar ALO artwork and SAO theme presets

## Themes (subagents, own worktrees)
- [x] ALO theme: ALO SFX preset (`sfx-alo.json`) and ALO HP-bar style (`HPBar/alo-*.png`, `BarALO.qml`/`StyleALO.qml`)
- [x] GGO theme: launcher skin from `com.gpbeta.theme.ggo` QML/images (buttons, items, panel bars, dialog); see `docs/original-design.md` → GGO theme

## Widgets (main session)
- [x] SAO clock widget from `Presets/widget-clock.*`: 304×80 `clock-bg.png`, hour/minute pointers, 62 px SAO UI digital time, 5 s sampling; separate floating window like the HP display
- [x] Mail/message button (`widget-mail`): 56×56 desktop circle opening Message, unread indicator from accepted-friend conversations
- [x] Widget settings in Settings → Option → Interface → Desktop widgets: clock and Message button toggles
- [ ] Ask the user: the original `widget-mail` click opens `ShortcutMenu.qml` (a small SAO popup: Compose, Online players, Inbox, Settings). The port's button opens the launcher's Message category directly. Keep it that way, or port the popup?
- [x] End-to-end test: clicking the Message button opens the launcher on Message (`scripts/smoke-desktop.mjs`)

## Parity checks
- [x] Screen-edge accommodation: already implemented (`.original-menu` 400 ms InOutQuad `left` transition plus clamping in `main.tsx`); confirm in the desktop app
- [x] HP bar placement (user decision): stays top left, appears after Link Start, always in front of the launcher; follows the Always on top setting toward other apps (clock and Message button too)
- [x] Settings → Help opens https://sao-menu.favioon.com/support

## Link Start
- [x] Link Start blue forms (language selection, login, character registration) follow the system language and can be changed in Options; official anime text ("Welcome to Sword Art Online!", "Congratulations!!") stays original

## Naming
- [x] Rename the app from "SAO Utils 2" to "SAO Menu" (product name, window/tray/Options titles, About); keep existing settings, sign-in and updates working for current installs

## Navigation
- [x] Navigation → Field Map: SAO-style real-world map (MapLibre + OpenFreeMap, macOS Core Location helper, home-location fallback)
- [ ] Device check: Location Services prompt from the signed app

## Later (new anime-only features from the darkblackswords vector pack)
- [x] "Congratulations!!" banner, shown only on the first launch after an OS update (user decision 2026-10-04; not on level-ups)
- [ ] Duel-style window for party invites
- [ ] SAO window frames

## Not original features (platform work)
- [ ] Two-finger touch invocation; Windows/Linux global two-button gesture
- [ ] Mac notarization
- [ ] Native UI acceptance against the hosted account service
