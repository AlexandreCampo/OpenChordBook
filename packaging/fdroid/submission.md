# New app: OpenChordBook

OpenChordBook is an offline chord chart reader and editor for musicians, with
transposition, nested folders, chart import/export, named sections, mixed meters
and repeat bars. Android 7.0 or later.

- Maintainer: Alexandre Campo; submitted at the author's request.
- Source: https://github.com/AlexandreCampo/OpenChordBook
- Issues/contact: https://github.com/AlexandreCampo/OpenChordBook/issues
- Release: `v1.18`, versionCode 19, commit `cd3fcf40e7c8476d81fc350c893c11f2e7092ded`.
- License: GPL-3.0-or-later; third-party notices are preserved.
- Upstream CI: https://github.com/AlexandreCampo/OpenChordBook/actions/runs/35663898004

The reader, editor and library work offline. Native integration includes file
selection/export, catalog downloads, immersive reading and Back navigation.
No tunes are packaged; users download or import their own. Optional third-party
downloads are disclosed under `NonFreeNet` for review. No accounts, ads or analytics.

Fastlane includes the en-US descriptions, icon, synthetic-chart screenshots and
changelog. Font inputs, licenses and the rebuild script are documented upstream.
Development includes AI-assisted code, disclosed in CONTRIBUTING.md.

## Validation

Metadata parsing, formatting, lint, update detection, source scan, build and APK
scan passed in the official `buildserver-trixie` container using fdroidserver
`a35fdfddd9c66823987a410566a6101186e39c84`. No scanner exclusions are used.
The build uses AGP 9.4.1, Gradle 9.7.1, JDK 21 (Java source/target 17), SDK 36.
[Build details](https://github.com/AlexandreCampo/OpenChordBook/blob/main/packaging/fdroid/build-check.md).

Standard F-Droid signing is chosen for this initial submission. Reproduction of
the upstream signed APK has not been established, so `Binaries` and
`AllowedAPKSigningKeys` are not configured. The universal APK is about 2 MiB and
contains no native libraries; ABI splits are unnecessary. No external submodules
or srclibs are needed.

## Submission checklist

- [x] Public FLOSS source and dependencies; author supports inclusion.
- [x] Inclusion policy, contribution guide, metadata reference and quick-start guide reviewed.
- [x] Upstream en-US Fastlane descriptions, images and version-code changelog included.
- [x] One app and one metadata file, valid YAML with LF line endings.
- [x] Tagged release, automatic updates and full build commit hash configured.
- [x] Author name and public issue tracker included.
- [x] Only the latest build is included; no disabled versions.
- [x] Local official-container build and scanners pass.
- [ ] Public fork and unprotected submission branch published.
- [ ] GitLab submission pipeline passed; warnings reviewed.

If GitLab requires payment or identity verification for fork CI, please run the
pipeline in the F-Droid project. The local container build already passes.
