# Android

The Android app bundles the root web application in a small Java WebView shell.
Package: `io.github.openchordbook`. Minimum Android version: 7.0 (API 24).
Charts are imported or downloaded by the user; none are packaged in the APK.

## Requirements

- OpenJDK 21 for release builds, matching CI and F-Droid. Set `JAVA_HOME` to it.
- Android SDK platform 36 and build-tools 36.0.0.
- `ANDROID_HOME` set to your SDK, or an ignored `android/local.properties`
  containing `sdk.dir=/absolute/path/to/your/android-sdk`.

The checked-in wrapper downloads Gradle 9.7.1 with a pinned checksum.
Android Gradle Plugin is 9.4.1; Java source/target is 17. Dependencies are pinned
AndroidX Core 1.17.0 and WebKit 1.14.0. No Android Studio or npm install is needed.

## Build

From the repository root:

```sh
export JAVA_HOME=/path/to/openjdk-21
./scripts/build-release.sh
```

The helper checks the compiler version, builds an unsigned release and runs lint.
It also accepts a source checkout path to rebuild an older tag.
Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`.
An unsigned APK is suitable for source-build verification, but cannot be installed
as a normal release. For a quick isolated development install, from `android/`:

```sh
./gradlew assembleDebug
adb -s EMULATOR_SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
```

Debug builds use `io.github.openchordbook.securitytest`, with separate storage.
Use `adb devices` to select the intended emulator/device explicitly.

## Release signing

Keep a single private APK key for direct updates. If creating a key for a new
application, store it **outside the source checkout** and back it up securely:

```sh
keytool -genkeypair -keystore /PRIVATE/PATH/openchordbook-release.keystore   -alias OpenChordBook -keyalg RSA -keysize 4096 -validity 10000
```

Create the ignored `android/keystore.properties` locally:

```properties
storeFile=/PRIVATE/PATH/openchordbook-release.keystore
storePassword=YOUR_PRIVATE_STORE_PASSWORD
keyAlias=OpenChordBook
keyPassword=YOUR_PRIVATE_KEY_PASSWORD
```

Then run `./gradlew assembleRelease`. The result is
`app/build/outputs/apk/release/app-release.apk`. Without local signing settings,
the build remains unsigned. `-PunsignedRelease=true` explicitly bypasses signing.
Never commit that properties file or key; the public repository contains neither.
If updating an existing installation, use its existing key rather than generating
another one. Different keys require uninstalling, which loses the local library.

For releases distributed through the reproducible F-Droid recipe, use JDK 21,
build with `-PunsignedRelease=true`, then sign the unsigned APK with
`$ANDROID_HOME/build-tools/36.0.0/apksigner`. Keep its default alignment options:
the recipe reproduces that padding. Verify the exact signed APK against a clean
F-Droid rebuild before publishing each release. See the build verification record
linked from the submission guide.

Keep an encrypted backup of the existing keystore on separate storage, and
retain its alias and passwords. The public certificate fingerprint is safe to
include in metadata; the private keystore and passwords are not needed by F-Droid.

## Install a signed release

Transfer the APK to your phone and open it, allowing installation from your
file manager if Android asks. Alternatively, with USB debugging enabled:

```sh
adb devices
adb -s DEVICE_SERIAL install -r app/build/outputs/apk/release/app-release.apk
```

The `-r` update preserves app storage only when the package/signing key is
compatible. Never clear app data or wipe an emulator to resolve an update problem
without first considering the library stored there.

## Native integration

The shell adds playlist downloads, Android's import/save file pickers,
full-screen reading and Back navigation to the web app. Export uses the system
Save as window and needs no storage permission.

The versioned asset path (`/assets/v19/web/` for versionCode 19) avoids stale
service-worker scopes while retaining the IndexedDB origin. Update it together
with the version when releasing changes. Gradle's generated
`app/src/main/assets/web/` directory must never be edited or committed.

## Verification and publishing

See [tests/README.md](../tests/README.md) for isolated emulator tests and APK
inspection, [releases](../docs/releases.md) for the checklist and
[F-Droid packaging](../packaging/fdroid/README.md) for submission instructions.
