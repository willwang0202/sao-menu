# Original SAO theme: implementation reference

This reference records the supplied SAO Utils 2 design and mechanism for the current local Steam-launcher mirror. It is a source specification, not a claim that every listed behavior is implemented identically. Measurements come from readable QML/configuration and PNG headers, without executing or disassembling the Windows program. The installation inspected on October 2, 2026 was:

`/Volumes/Music Library/crossover/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/SAO Utils 2/`

The installed core reports 1.7.0 and SAO theme 1.0.6. [original-manifest.json](../resources/original-manifest.json) contains the source location, measured constants, original category tree and 61 selected asset records with dimensions/size/SHA-256. Asset/code notices remain associated with their original creators; `win64/README.EN.txt` and `Packages/com.gpbeta.theme.sao/LICENSE.GPGPL` are their source notice files. Local personal reuse authorized by the user does not establish general redistribution permission.

## Where the design lives

All paths below are relative to the supplied bundle.

| File | Role |
| --- | --- |
| `Packages/com.gpbeta.theme.sao/qml/ThemeLauncher.qml` | Screen margins, root view and theme editing options |
| `Packages/com.gpbeta.theme.sao/qml/MainView.qml` | Root icon stack, submenu placement and selection |
| `Packages/com.gpbeta.theme.sao/qml/MainButton.qml` | Circular category button states and feedback sound |
| `Packages/com.gpbeta.theme.sao/qml/MenuView.qml` | Recursive submenu, scrolling, transitions and child selection |
| `Packages/com.gpbeta.theme.sao/qml/ItemButton.qml` | Menu ribbon, item icon, type and state colors |
| `Packages/com.gpbeta.theme.sao/qml/ThemeText.qml` | Font and text wrapping/outline |
| `Packages/com.gpbeta.theme.sao/qml/PanelView.qml` | Left information card, collapse/expand animation |
| `Packages/com.gpbeta.theme.sao/qml/IndicatorView.qml` | Gold bracket indicator |
| `Packages/com.gpbeta.theme.sao/qml/HPBar.qml`, `HPBarLabel.qml` | Original CPU/memory HP widgets |
| `win64/qml/com/gpbeta/private/LauncherTemplate.qml` | Cursor-relative positioning, edge accommodation and dismissal offset |
| `Configs/system/launcher/menu.xml` | Original recursive menu items/actions |
| `Configs/system/launcher/themes/launcher@sao.theme.gpbeta.com.xml` | Per-item icons and information-panel flags |

## Geometry and presentation

The launcher uses isolated floating controls over the actual desktop. It does not have a permanent app header, navigation sidebar, enclosing dark card, or dashboard backdrop in the SAO theme.

| Element | Original values |
| --- | --- |
| Root stack viewport | 64 × 414 px |
| Circular root button | 64 × 64 px; 6 px vertical gap; 46 × 46 px icon, 9 px padding |
| Root stack capacity | `PathView.pathItemCount = 7`; visible count is min(item count, 7) |
| Root stack top padding | max(414 − (visible count × 64 + (visible count − 1) × 6), 0) / 2 |
| Submenu viewport | 182 × 310 px |
| Menu item | 182 × 46 px; −2 px vertical gap (44 px pitch) |
| Submenu capacity | `pathItemCount = 8`; visible count is min(item count, 8) |
| Item inset/icon | Left 35 px, right 16 px; 26 × 26 px icon, 9 px text gap |
| Typography | SAO UI with Source Han Sans fallback; 15 px, medium weight; up to 2 lines, 16 px line height |
| Root indicator | Root x + 64 + 4; same vertical center as first root item |
| First submenu | Root x + 74; root y + top padding + 32 − 155 |
| Nested submenu | Parent submenu x + 172; same y as parent |

QML colors use `#AARRGGBB`, whereas CSS eight-digit hex uses `#RRGGBBAA`. Translate the byte order when reproducing:

- Item text: normal `#CC333333`, hovered/pressed `#EEFFFFFF`.
- Information label/description: `#BB333333`.
- HP labels: `#CCFFFFFF`, outline `#22FFFFFF`; main name 16 px, default other labels 14 px.
- The normal text outline uses the current RGB with alpha 0.125.

Shape, gold selection color, highlights and shadows are supplied by PNG assets rather than QML flat-color rectangles. Use the original state images at their intrinsic sizes for the mirror:

- `Images/background/btn.png`, `btn-hovered.png`, `btn-pressed.png` (64 × 64); `btn-mask.png` and `btn-mask-checked.png` (64 × 414).
- `Images/background/item.png`, `item-hovered.png`, `item-pressed.png`, `item-selected.png` (182 × 46); `item-mask.png` (182 × 310).
- `Images/etc/indicator-upper.png` and `indicator-lower.png` (28 × 115 each). The indicator is 28 px wide, minimum total height 70 px, capped at 230 px. Upper/lower image border sizes are 20/13 and 13/20 respectively.
- `Images/etc/panel.png` (270 × 421) and `panel-shadow.png` (270 × 8); collapsed card height 278 px. The card is immediately left of the root (x − 271), with y at root y + top padding + 32 − 215.

`Fonts/SAOUI-Regular.otf` supplies the SAO UI font. The launcher QML also uses Source Han Sans. The current local importer copies `SourceHanSans-Medium.ttc` and uses Python `fontTools` to extract its first face as `SourceHanSans-Medium.otf` for Chromium. Extraction must succeed for original CJK glyphs; production builds require it. Font Awesome Pro's original Regular face supplies the external-viewer glyph on media previews; the launcher uses the original raster icons.

## Categories and nesting

The supplied root tree has five categories, in this order:

| ID | Label | Original root icon | Children |
| --- | --- | --- | --- |
| `user` | Kirito | `Images/symbol/info.png` | Items → documents/music/pictures/videos; Skills → Explorer/Notepad/Calculator/CMD; Equipment → Events/Services/Management |
| `party` | Party | `Images/symbol/party.png` | Live Windows Start Menu folder |
| `message` | Message | `Images/symbol/msg.png` | Live Windows Desktop folder |
| `navigation` | Navigation | `Images/symbol/navi.png` | Search → Google/Bing/Yahoo/Baidu; Favorite → original SAO links/Bilibili |
| `settings` | Settings | `Images/symbol/setting.png` | Option, Help, Exit |

Every root icon has a `-hovered.png` counterpart. Item icons come from `Images/item` and its category folders; `items.png`, `skills.png`, `equipment.png`, `option.png`, `help.png`, and `logout.png` cover the main submenu entries. A plain submenu defaults to the help icon; folders/files default to `folder.png`/`file.png`, with hover variants.

The user category enables its information panel and uses `Images/etc/info.png` (200 × 200); the settings category also enables a panel. Other panels are enabled per item, rather than globally displayed for every choice.

## Selection and scrolling

Opening the launcher resets root `currentIndex` to 0 and automatically checks the first root item when its entrance finishes. Root category buttons are checkable. The readable QML assigns `PathView.currentIndex` and binds the initial submenu position to the root path origin; interpreting that as a required button reorder produced the wrong observed interaction. The user's reference behavior is the acceptance criterion: category selection preserves button positions and moves the expanded menu, information panel and bracket to the selected button. Selection and deliberate scroll/drag use separate state in the port. Selecting a leaf triggers its action and clears its checked state.

Submenus are recursive. Their preferred highlight start/end is 0.5, so selecting a parent menu row moves that row to the vertical center and opens the next column at the same y. Other background images dim to opacity 0.5 while a child is selected. Beginning path scrolling clears the selected child, and an item leaving the current path position also unchecks itself. Small menus snap to one item; menus at/above path capacity use no snap. Highlight movement duration is 250 ms.

The indicator is visible only while its target menu has no checked descendant, so the gold bracket appears at the active end of the menu chain. Child menus are unloaded when the root ceases being exposed. Folder menus reload their contents on selection. This stateful, moving chain is more than a row of static app buttons.

## Placement and animation

Cursor invocation positions root x at cursor x − 32 and y at cursor y − 150. The theme clamps these to screen margins of left 400, right 300, top 200 and bottom 300 px. If an alignment is specified, x is its corresponding screen left/center/right coordinate and y is screen top + (screen height − 150) / 2. As the chain/card reaches either horizontal screen edge, the base template shifts the root to accommodate it over 400 ms with InOutQuad easing.

| Event | Original transition |
| --- | --- |
| Root entrance | Opacity 0 → 1 over 600 ms; each button slides down to its final position over 200 ms OutQuart, with 100 ms reverse-index staggering up to five visible items |
| Root dismissal | Opacity 1 → 0 and root list y → −414 over 400 ms (list OutQuad); base root x shifts −500 over 400 ms InOutQuad |
| Submenu entrance | Opacity 0 → 1 over 400 ms; list y −310 → 0 over 600 ms OutQuart |
| Submenu dismissal | Opacity 1 → 0 over 400 ms; list y → −310 over 300 ms InQuad; hide after completion |
| Indicator | Fade in 250 ms/out 200 ms; bracket height change 200 ms OutQuad |
| Info-panel opening | Width/height from 80 px over 400 ms OutQuart, opacity over 500 ms; reveal content after collapsed state then expand if description exists |
| Info-panel change | Resize 250 ms OutQuart, content fade 250 ms |
| Info-panel closing | Opacity → 0 over 250 ms |

The original masks fade/clip the stacks at their edges. Preserve them when approximating Qt PathView in another renderer.

## Sound and input mechanisms

The original SAO SFX preset resolves through the manifest to these files under `Packages/com.gpbeta.theme.sao/Sounds`:

| Event | File |
| --- | --- |
| Press a root/menu/HP button | `Feedback.SAO.Click.wav` |
| Show launcher | `Popup.SAO.Launcher.wav` |
| Show submenu, delayed 300 ms | `Popup.SAO.Menu.wav` |
| Show info panel | `Popup.SAO.Panel.wav` |
| Dismiss launcher | `Dismiss.SAO.Launcher.wav` |

`win64/README.EN.txt` describes the global invocation gesture: hold left and right mouse buttons together, then slide downward. For touch devices it describes holding two fingers and sliding down. `Configs/system/hotkey.xml` contains Qt key value 134217811 (`0x08000053`), corresponding to **Alt+S**, and the toggle-launcher action.

The global input hook, gesture threshold and host-level keyboard dismissal behavior are implemented in compiled modules and were not recovered by this read-only source inspection. A local DOM gesture is not equivalent to invocation while another app is active; a matching port must supply a native global-input mechanism and accurately state any permission/platform limits.

The current macOS port supplies a Swift/CoreGraphics passive native observer for this two-button downward gesture, with Input Monitoring permission. It uses a 64-point threshold with horizontal tolerance, triggers once per held chord, and resets when a button is released. An upward chord dismisses. These numeric thresholds and upward dismissal are port choices, not recovered original constants. The helper's state-machine self-test covers 23 checks without injecting input; actual global pointer delivery requires macOS permission/session acceptance. Other operating systems and two-finger touch remain separate native input work.

## Browser, media and cursor reference

The user's [publisher demonstration](https://www.youtube.com/watch?v=82yPo7IMMAk), **Sword Art Online Look & Feel on Windows — SAO Utils 2**, shows an overlay over a blurred desktop, simultaneous image/video previews, a filename title with an external-viewer icon, and a browser whose tab, page and lower status frame curve together. Cursor movement changes the surfaces' perspective. The channel's [SAO Utils 2.0 Early Preview — Launcher & Widget Features](https://www.youtube.com/watch?v=fNdbu9Mxd0c) also shows transparent image widgets and the original widget preference editors. Its HUD/HP widgets are separate original features; their presence does not establish their implementation in this port.

`Packages/system/Images/web-frame.png` supplies the tab/globe contour, with separate close/reload/stop and hovered sprites. The port composites this artwork and an actual isolated browser page into a curved texture, then inverse-maps mouse input into the underlying browser's coordinates. The port uses a quadratic cylindrical approximation with `pageBend = 0.11`, 160 ms tilt smoothing and capped perspective angles. These values are reconstructed choices: the original browser and cursor compositor is in compiled native modules, so matching the screenshots does not prove identical deformation or motion timing.

`Packages/com.gpbeta.media/qml/ImageWidget.qml` specifies an animated image, filename title, transparent widget, default Auto Resize and Fit, Crop, Reset Size and Change Image. `VideoWidget.qml` specifies looping, default unmuted autoplay, pause/resume on click, Fit/Crop, size reset/change, and pause while not exposed. Those readable behaviors guide the current media surfaces. The source gallery's GL slideshow, complete widget host and drag/drop remain separate parity work. The installation does not supply the anime clips shown in the demonstration; imported tutorial GIFs and a generated video fixture are used for verification.

## HP and clock widgets

The original HP preset binds the main Kirito bar to CPU load and extra Asuna bar to physical RAM, sampled every 1,000 ms. `hp-main.png` is 358 × 62; charging variant 360 × 62. Main HP mask is 258 × 24 at (78,12). The bar switches green/yellow/red at progress >0.5 / >0.25 / ≤0.25 and slides under its mask over 500 ms OutQuart. Maximum display HP is max(level,1) × 250; the available theme source does not define how host level is derived. The labels show current/max HP and `LV:`. Extra HP background is 218 × 42 with 125 × 17 bar at x82/y12.

The original clock preset is 304 × 80 using `clock-bg.png`, hour/minute pointer images of 5 × 16 and 5 × 22 px, and 62 px SAO UI digital time. It samples time every 5,000 ms. This original preset is not fully ported.

The current native actions use macOS equivalents and local folders. The launcher adopts the original sprite geometry, category tree, fonts and sounds while approximating Qt PathView/compositor transitions in React/CSS. Full original preferences, HP/clock/widget presets and QML/native plug-in behavior remain incomplete. See [compatibility.md](compatibility.md) for the current implementation boundary.
