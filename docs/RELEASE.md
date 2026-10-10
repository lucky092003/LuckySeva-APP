# APK Release Workflow (GitHub Releases + QR)

Both apps ship from this one repo as free downloads on GitHub Releases.

- Download page (stable URL, always latest release):
  `https://github.com/lucky092003/LuckySeva-APP/releases/latest`
- QR code (never changes — same QR keeps serving newer versions):
  - Simple: `docs/qr-download.png`
  - Poster (framing/printing): `docs/qr-download-poster.png`

## One-time setup (done)

1. JDK 21 (Temurin) required by Capacitor build — installs at `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`.
2. Android SDK cmdline-tools + `platforms;android-36` + `build-tools;36.0.0` at `C:\Users\lucky\AppData\Local\Android\Sdk` (path recorded in `android/local.properties`, gitignored).
3. Release signing:
   - Keystore: `android/app/release.keystore` (gitignored — NEVER commit)
   - Passwords: `android/keystore.properties` (gitignored — NEVER commit)
   - Offline backup copies: `C:\Users\lucky\Documents\luckyseva-keystore-backup\`
   - If lost, the Play Store / installed apps can never update the app again. Keep at least 2 backups.
4. `gh` CLI login (interactive, run once): `gh auth login` → GitHub.com → browser.

## Every release (repeat these steps)

1. Bump versions in `android/version.properties` (commit):
   - `versionCode` = previous + 1
   - `versionName` = e.g. `1.1.0`
2. Build both APKs (PowerShell):
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
   cd frontend
   npm run build:customer
   cd ..\android
   .\gradlew.bat assembleRelease
   Copy-Item app\build\outputs\apk\release\app-release.apk ..\releases\LuckySeva-v1.1.0.apk
   cd ..\frontend
   npm run build:partner
   cd ..\android
   .\gradlew.bat assembleRelease
   Copy-Item app\build\outputs\apk\release\app-release.apk ..\releases\LuckySeva-Partner-v1.1.0.apk
   ```
   (The native project reads the role from the synced `capacitor.config.json`,
   so the same build produces `com.luckyseva.app` for faster customer and
   `com.luckyseva.partner` for faster partner, including the right app label.)
3. Dry verify: APKs must exist in `releases/` (this folder is gitignored; it is only a staging area).
4. Publish to GitHub:
   ```powershell
   cd C:\Users\lucky\Desktop\LuckySeva-App
   gh release create v1.1.0 `
     releases\LuckySeva-v1.1.0.apk `
     releases\LuckySeva-Partner-v1.1.0.apk `
     --title "LuckySeva v1.1.0" --notes "- Summary of this release"
   ```
5. Users scan the QR / visit the page → get this new version. The QR never changes.
