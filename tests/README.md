# Tests

Run commands below from the repository root unless stated otherwise. Tests
use synthetic charts and isolated browser profiles. The native integration
package is separate from the normal app; never clear a real library for testing.

## Local suite

Prerequisites: Python 3.10+, Node.js 22+, JDK 17+, and Playwright Chromium.

```sh
npm ci
npx playwright install chromium
npm test
```

The runner starts and stops its own local server on an available port. It
runs these groups, stopping on a failure:

| Directory / command | Coverage |
| --- | --- |
| `tests/tooling.py` / `npm run check` | Static export, private-file boundaries and documentation links |
| `tests/unit/` / `npm run test:unit` | Chord compilation, import/export round trips, limits and native bridge lifecycle |
| `tests/browser/` / `npm run test:browser` | Phone/desktop UI, folders, editor, import/export files, download failures, injection and offline notices |
| `tests/native/` / `npm run test:native` | JVM-only network policy, redirects, limits, cancellation, deadlines and file export bounds |

Browser cases mock external responses and do not download community repertoire.
Screenshots written to the temporary directory contain synthetic charts only.

Individual browser scripts can run against an existing preview by setting
`JAZZ4ALL_URL` to a localhost URL. `PLAYWRIGHT_MODULE` can point to an existing
Playwright installation; `BROWSER_EXECUTABLE` can point to a Chromium binary.
The runner supplies its own URL, ignoring any existing preview's port.

## Android build and APK inspection

Set up the SDK as described in [android/README.md](../android/README.md):

```sh
cd android
./gradlew assembleRelease -PunsignedRelease=true lintRelease
cd ..
python3 tests/android/apk-assets.py android/app/build/outputs/apk/release/app-release-unsigned.apk
python3 tests/android/release-security.py --unsigned android/app/build/outputs/apk/release/app-release-unsigned.apk
```

These inspect the actual APK for bundled tunes, unsafe permissions, debugging,
backup rules, asset freshness and private keys. For the **signed** release,
run both scripts with the signed APK path and omit `--unsigned`; the security
check then also verifies the APK signature. The SDK's `apksigner` and `aapt`
are required. `ANDROID_HOME` or `ANDROID_SDK_ROOT` selects the SDK.

## Android instrumentation (explicit integration check)

Start a test emulator, find its serial with `adb devices`, and replace
`EMULATOR_SERIAL` below. From `android/`:

```sh
./gradlew assembleDebug assembleDebugAndroidTest
adb -s EMULATOR_SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
adb -s EMULATOR_SERIAL install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s EMULATOR_SERIAL shell am instrument -w com.jazz4all.android.securitytest.test/com.jazz4all.android.SecurityInstrumentation
```

Require **PASS** in the runner output; adb's process exit status alone is not
proof of a passing instrumentation run. This suite tests the actual WebView
bridge/origin boundaries, navigation, resource loading, storage and rendering.
It also performs live previews against the catalog's three allowed hosts;
source availability or changed playlist counts can cause a failure. It does
not save these collections in the production app.

After testing, remove only the isolated packages if desired:

```sh
adb -s EMULATOR_SERIAL uninstall com.jazz4all.android.securitytest.test
adb -s EMULATOR_SERIAL uninstall com.jazz4all.android.securitytest
```

The workflow does not automatically run live-network emulator tests. Trigger
and inspect them when native behavior or catalog downloads change.

## Store screenshots and fonts

With a local preview running:

```sh
node scripts/capture-store-screenshots.cjs
```

This rewrites the five phone screenshots in fastlane using synthetic practice
charts. Review the images before committing. Font rebuilding and its verified
input checksum are documented in [vendor/css/FONT.md](../vendor/css/FONT.md).

The isolated Android suite also checks export cancellation, exact UTF-8 file
contents and provider write errors. Its document provider exists only in the
debug build. Use the system Save as window on an emulator for a manual UI check.
