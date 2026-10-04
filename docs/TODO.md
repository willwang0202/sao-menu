# Port backlog

Working list for the SAO Utils 2 port. Scope decisions (keep/drop) were made with the user on 2026-10-04; anything from the original packages not listed here needs the user's decision before porting.

Branch: `feat/themes-and-widgets`.

## Shared scaffold
- [x] `Settings.theme` (`sao` | `alo` | `ggo`), validated in `normalizeSettings`, default `sao`
- [x] `src/shared/themes.ts`: theme names and `themeSound(theme, event)` with SAO fallback
- [x] Launcher sounds go through `themeSound`; `data-theme` on `.sao-desktop`
- [x] Theme selector in Settings → Option → Interface
- [x] Importer copies GGO theme images/presets, HP-bar ALO artwork and SAO theme presets

## Themes (subagents, own worktrees)
- [ ] ALO theme: ALO SFX preset (`sfx-alo.json`) and ALO HP-bar style (`HPBar/alo-*.png`, `BarALO.qml`/`StyleALO.qml`)
- [ ] GGO theme: launcher skin from `com.gpbeta.theme.ggo` QML/images (buttons, items, panel bars, dialog)

## Widgets (main session)
- [ ] SAO clock widget from `Presets/widget-clock.*`: 304×80 `clock-bg.png`, hour/minute pointers, 62 px SAO UI digital time, 5 s sampling; separate floating window like the HP display
- [ ] Mail/message button (`widget-mail`): 56×56 desktop circle opening Message, unread indicator from accepted-friend conversations
- [ ] Widget settings in Settings → Option (not a right-click menu): show/hide HP, clock and mail widgets; SAO `item-preview` artwork per the original `ShortcutMenu.qml`

## Parity checks
- [x] Screen-edge accommodation: already implemented (`.original-menu` 400 ms InOutQuad `left` transition plus clamping in `main.tsx`); confirm in the desktop app
- [ ] HP widget's launcher-open position from `theme-widget.json` (`launcher: x200 y128 z100 anchor 2`): confirm meaning of anchor before changing
- [ ] Settings → Help: decide target (README or support page)

## Later (new anime-only features from the darkblackswords vector pack)
- [ ] "Congratulations!!" banner when account level increases
- [ ] Duel-style window for party invites
- [ ] SAO window frames

## Not original features (platform work)
- [ ] Two-finger touch invocation; Windows/Linux global two-button gesture
- [ ] Mac notarization
- [ ] Native UI acceptance against the hosted account service
