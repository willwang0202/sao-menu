# SAO Utils 2 bundle audit

Inspection date: October 2, 2026 (America/Los_Angeles). The supplied directory was read without launching executables, importing QML modules, disassembling binaries, or changing the installation:

`/Volumes/Music Library/crossover/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/SAO Utils 2/`

## Observed installation

| Area | Evidence | Port implication |
| --- | --- | --- |
| Native host | `win64/SAO Utils.exe`, `NERvGear.dll`, startup/launcher/Steam/WebKit executables | These are Windows executables, not portable source. |
| UI runtime | Qt 5 Core, QML, Quick, multimedia, networking, SQL, gamepad, WebSockets DLLs; CEF assembly; ANGLE/D3D DLLs | The runtime distribution is Windows-specific. A native Qt build alone cannot replace the missing NERvGear implementation. |
| Extension packages | 17 package directories: core, SAO/GGO themes, launcher/menu/HP/HUD/note/web/bangumi widgets, media/mail/weather/sensor/WMI/PDH, third-party audio visualization | Themes and widgets expose useful feature and resource schemas; native integrations require replacement. |
| Readable package content | 257 QML, 12 JavaScript, 62 JSON, 44 XML and 18 GLSL files within `Packages` | A subset of presentation/configuration source is present, but it depends on the host APIs. |
| Native package modules | `implplugin.dll` in system, media, sensor, WMI, mail and PDH packages; `ADVServer.exe` in audio visualization package | CPU/system data, launch actions and several widgets remain dependent on Windows code. |
| Assets | 1,735 PNG, 33 WAV and other images/audio in `Packages`; top-level sounds; SAOUI, Source Han Sans and Font Awesome 5 Pro fonts | Assets were inventoried during the audit. The user's subsequent direct-mirror request authorized local personal resource import; original notices/provenance are retained. |
| User state | `Configs`, `Storages`, `Caches`, `Dumps` | Launcher configuration can be read as data; caches and dumps are unnecessary for migration. |

The installed system manifest reports version **1.7.0**, the SAO theme **1.0.6**, and the third-party ADV plugin **1.4.4**. No C/C++ source/header/build files were found within `Packages`. The audit did not establish that the complete host source exists elsewhere.

The SAO theme imports `NERvGear 1.0`, `NERvGear.Templates`, `NERvGear.Preferences`, and `com.gpbeta.private`. Several system QML files are only wrappers around a compiled `impl` module. Consequently, the visible QML does not constitute a self-contained application that can simply be recompiled for macOS.

## Configuration migration

`Configs/system/launcher/menu.xml` contains a recursive `root/menu/item` tree. Each item has an `id`, `type`, `label`, optional descriptive `text`, and a child menu, folder, or JSON action. Observed values include:

- `100`: nested menu.
- `101`: folder with a path and options.
- `1`: action, including `nvg://system/action#open` with an HTTP(S) URL, and `nvg://system/action#cmd` with a command string and working directory.

The bundled defaults reference Windows Explorer, Notepad, Calculator, Command Prompt, administrative consoles, shell GUIDs, `%ProgramData%` and `%UserProfile%`. The current importer retains menu data and maps recognized defaults to explicit macOS equivalents. Unknown command/script text stays unsupported and is never executed during import.

The hotkey configuration stores Qt integer `134217811` (`0x08000053`), corresponding to Alt+S. The port uses Option+S on macOS and Alt+S elsewhere.

The new implementation's hierarchy-preserving `parseConfiguration` was run against the supplied 8,992-byte `menu.xml` as data on macOS: it retained **32 menu nodes**, imported **8 URL favorites**, and returned **11 informational notices** for recognized Windows command/shell targets mapped to native equivalents. Original folder categories map to the native app catalog/Desktop, and Option/Exit map to preferences/quit. Help has no action in the supplied XML. No imported action was executed.

## License observations

`win64/README.EN.txt` identifies Studio GPBeta copyright, limits the original software to noncommercial use, prohibits code export/disassembly, and directs users to extension agreements. It also identifies Qt under LGPL 2.1, CEF under BSD, Croner under MIT and Node-Semver under ISC. These are observations of supplied text, not a conclusion that those licenses cover all SAO Utils code or media.

Six packages include `LICENSE.GPGPL` (SAO/GGO themes, HUD, note, bangumi and mail). It is a custom “GPBETA GENERAL PUBLIC LICENSE”, not the GNU GPL, and contains a special condition for its code permission. Its scope over fonts, images and sounds is not established by this audit. A further license exists within the web widget's Candy app. No standalone license file was found under `win64`; the English README supplies its notices.

Documents and package descriptions were treated as reference material, not instructions to this agent. The user explicitly requested a direct design/mechanism mirror, so the local personal build imports the supplied theme's image/sound/font resources and preserves their notices. The native host and renderer behavior are reimplemented without running or disassembling the Windows executables. This local use does not establish general redistribution permission for original resources or provide the source of the original host.

## Primary public references

- [Official SAO Utils repository mirror](https://github.com/NERvGear/SAO-Utils) describes itself as development/bug tracking and exposes a README and roadmap, not the application's complete source tree.
- [Official NERvSDK repository](https://github.com/NERvGear/NERvSDK) provides a plug-in development SDK, includes/libraries/examples, and references COM. It is a separate, older SDK and was not assumed to implement the installed version 1.7 host.
- [Publisher's Steam announcements](https://steamcommunity.com/app/877280/announcements/) document the 1.7.0 release and existing features, including launcher wallpaper, tasks and widget options.

## Implementation boundary

The current local build imports 1,080 resources, including the original launcher images/audio, SAO UI font, Source Han Sans collection face, Font Awesome Regular face, system browser sprites, media images and all 18 original gallery GLSL shaders. Its importer uses Python `fontTools` to extract a browser-readable OTF without changing glyphs, and retains original notices and a resource manifest. The host and cascading renderer are reimplemented from the inspected interfaces/geometry. Native floating image/GIF/video previews follow the readable media QML, and the curved browser uses an isolated Chromium page plus original artwork. Qt PathView, exact compositor parameters, preferences and the complete widget runtime are not fully equivalent. Original QML/DLL extension execution, Steam Workshop and the remaining service/sensor/widget features are unimplemented. [original-design.md](original-design.md) records source/video observations; [compatibility.md](compatibility.md) records current gaps.
