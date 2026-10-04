SAO Menu 0.1.6 carries forward the real-time Link Start, original menu artwork, curved browser/media previews, saved browser FOV, login-gated HP display and merged webcam hand gestures.

- The project and repository are now **sao-menu**.
- The website and fixed account service are **https://sao-menu.favioon.com**. No address configuration is shown, and the launch screen offers Create account. Friends, presence and direct messages use the same account on the website and desktop. The previous sao.favioon.com hostname remains available for older clients.
- Downloads: macOS Apple Silicon and Intel (DMG/ZIP), Windows x64 (installer/ZIP), Linux x64 (AppImage/DEB).
- Menu and HP labels use your account display name. HP represents battery percentage, or 100% with no battery. Companion bars appear only for accepted party members; Social includes party invitations, acceptance/decline and leaving.
- Bug reports: https://github.com/willwang0202/sao-menu/issues/new?template=bug_report.yml. GitHub login is required to submit a report; the website's Support page links to reports and their progress.

**Controls:** Option+S on macOS, Alt+S on Windows/Linux. The tray also opens the menu. Camera hand gestures are off by default: two-finger downward swipe opens, pointing aims, forward push selects, open-hand sideways swipe closes. Global both-mouse-button gestures currently require macOS and Input Monitoring.

**Install:** Mac builds are not notarized. Windows installers are unsigned. On Linux, make the AppImage executable before opening it, or install the DEB. The desktop app keeps its original SAO Utils 2 product name and application ID so existing settings and credentials continue to work.

Native release jobs run the 102-test suite, verify packaged files against the build and launch each packaged app. Physical camera accuracy, OS permission dialogs and full desktop integration still need real-device testing. Checksums and per-platform verification reports are attached to this release.

The build-assets archive is for reproducing tagged builds, not an installer. It contains the imported artwork and local MediaPipe model. Original creator notices remain included.

Unofficial fan project, not affiliated with the creators of Sword Art Online or the original SAO Utils.
