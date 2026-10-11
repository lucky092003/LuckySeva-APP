# APK Release Workflow (GitHub Releases + QR)

Both apps ship from this one repo as free downloads on GitHub Releases.

- Download page (stable URL, always latest release):
  `https://github.com/lucky092003/LuckySeva-APP/releases/latest`
- QR code (never changes — same QR keeps serving newer versions):
  - Simple: `docs/qr-download.png`
  - Poster (framing/printing): `docs/qr-download-poster.png`

## Automatic release on merge (GitHub Actions)

`.github/workflows/android-apks.yml` runs on **every push to `master`** (and
supports manual runs via `workflow_dispatch`). It:

1. Writes `frontend/.env` from the `VITE_API_URL` repository secret.
2. Builds + syncs the web bundle for **customer**, runs `assembleRelease`, and
   copies the APK to `releases/LuckySeva-<version>.apk`.
3. Repeats for **provider** (`releases/LuckySeva-Partner-<version>.apk`).
4. Uploads both APKs to the **latest GitHub release** with `gh release upload
   --clobber` — this is what keeps `releases/latest` always serving fresh builds.
5. Also uploads the APKs as run artifacts as a backup.

### Required repository secrets

Configure under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `VITE_API_URL` | Live API base URL, e.g. `https://luckyseva-app-gbjw.onrender.com` (no trailing slash) |
| `ANDROID_KEYSTORE_BASE64` | Base64 of `android/app/release.keystore` (on Windows: `certutil -encode android\app\release.keystore out.txt` and copy the payload without the BEGIN/END lines) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore store password |
| `ANDROID_KEY_ALIAS` | Signing key alias |
| `ANDROID_KEY_PASSWORD` | Signing key password |

Behaviour depends on the secrets:

- **All signing secrets present** → signed `release` APKs are published to the GitHub release.
- **Keystore secrets missing** → the workflow falls back to `debug` APKs
  (installable for testing, not Play-Store-worthy) and skips the release
  upload; the APKs are then only available as workflow artifacts.

Notes learned while setting it up: the runner needs **Node 22** (Capacitor CLI
requires >=22) and **JDK 21** (Capacitor compiles with Java source release 21);
the workflow itself runs `chmod +x android/gradlew` and `mkdir -p releases`
(the folder is gitignored, so it never exists on a fresh runner).

## Every release (what stays manual)

1. Bump versions in `android/version.properties` (commit):
   - `versionCode` = previous + 1
   - `versionName` = e.g. `1.1.0`
2. Merge the PR to `master` — CI builds and publishes the APKs automatically.
   For a re-run without a push: **Actions → Android APKs → Run workflow**.

## Manual build (local machine, fallback)

One-time setup (done):

1. JDK 21 (Temurin) required by Capacitor build — installs at `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`.
2. Android SDK cmdline-tools + `platforms;android-36` + `build-tools;36.0.0` at `C:\Users\lucky\AppData\Local\Android\Sdk` (path recorded in `android/local.properties`, gitignored).
3. Release signing:
   - Keystore: `android/app/release.keystore` (gitignored — NEVER commit)
   - Passwords: `android/keystore.properties` (gitignored — NEVER commit)
   - Offline backup copies: `C:\Users\lucky\Documents\luckyseva-keystore-backup\`
   - If lost, the Play Store / installed apps can never update the app again. Keep at least 2 backups.
4. `gh` CLI login (interactive, run once): `gh auth login` → GitHub.com → browser.

Repeat these steps:

1. Build both APKs (PowerShell):
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
   (`npm run build:customer` / `build:partner` in `frontend/package.json` set
   `VITE_APP_ROLE` and the live `VITE_API_URL`, and run `cap sync android` in
   one command. The native project reads the role from the synced
   `capacitor.config.json`, so the same build produces `com.luckyseva.app` for
   the customer and `com.luckyseva.partner` for the partner, including the
   right app label.)
2. Dry verify: APKs must exist in `releases/` (this folder is gitignored; it is only a staging area).
3. Publish to GitHub:
   ```powershell
   cd C:\Users\lucky\Desktop\LuckySeva-App
   gh release create v1.1.0 `
     releases\LuckySeva-v1.1.0.apk `
     releases\LuckySeva-Partner-v1.1.0.apk `
     --title "LuckySeva v1.1.0" --notes "- Summary of this release"
   ```
   (To just refresh an existing release's assets:
   `gh release upload v1.0.0 releases\LuckySeva-*.apk --clobber`.)
4. Users scan the QR / visit the page → get this new version. The QR never changes.
