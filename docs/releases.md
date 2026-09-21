# Releases

Public source: https://github.com/AlexandreCampo/OpenChordBook

Release **1.18 / versionCode 19** is tagged as `v1.18`. Its
[official-container build check](../packaging/fdroid/build-check.md) passes.
The source uses GPL-3.0-or-later; copyright © 2026 Alexandre Campo. This repository does not
publish automatically. Review the source before committing, tagging or pushing.

## Before tagging

1. Run `npm ci`, install Playwright Chromium and run `npm test`.
2. Build/lint the Android release and run APK checks from [tests/README.md](../tests/README.md).
3. Run the isolated Android integration suite when native behavior changes.
4. Test an in-place update with the same signing key on a test device; keep
   the device's library intact. Verify reader, editor, folders and offline use.
5. Review the catalog links, dependency/font licenses, privacy documentation
   and the screenshots. No tunes or private user libraries belong in a release.
6. Check that the working tree contains no keys, private config or generated
   artifacts to commit. The ignore rules cover common private/build paths.

For each later release, update `versionName` and `versionCode` in
`android/app/build.gradle.kts`, the native asset scope in MainActivity and
NetworkPolicy, their instrumentation/JVM test URLs, the native user agents,
the About version, `package.json`/lockfile version and `sw.js` cache version.
Add `fastlane/metadata/android/en-US/changelogs/VERSION_CODE.txt` and update
the F-Droid recipe's version/build block. Keep APK version codes increasing.

## Source and APK artifacts

After review, commit the intended source and create the matching annotated
release tag (for this candidate, `v1.18`). Do not move an already published tag.
Build the release from that exact revision, using your existing private APK key.

From a clean checkout of the release tag:

```sh
python3 scripts/export-source.py dist/openchordbook-1.18-source.tar.gz
```

The exporter refuses a dirty tree and includes committed source/build scripts,
licenses and store metadata, with no Git history or ignored local files. It
also rejects common private signing/config paths. It never creates a commit.

Publish a GitHub release for the matching tag, attaching:

- `openchordbook-1.18.apk`, signed with the intended developer key.
- `openchordbook-1.18-source.tar.gz`, from that exact source revision.
- SHA-256 checksums and the release notes.

Keep corresponding source available alongside each distributed APK. Checksums
help detect corrupted files; Android's signing certificate controls update
continuity. A successful local build does not establish cross-machine or
F-Droid reproducibility.

## Web release

Run `python3 scripts/export-web.py` and publish only the generated static
application directory over HTTPS. See [web deployment](web-deployment.md).
The web app remains a supported distribution alongside Android.

## F-Droid and other routes

Use the [F-Droid guide](../packaging/fdroid/README.md) for official submission,
anti-feature review, signing choices and a self-hosted repository.

Direct GitHub release APKs can also be followed by
[Obtainium](https://github.com/ImranR98/Obtainium). This is an update source,
not an independent source-build review.

IzzyOnDroid's [current AI-code policy](https://izzyondroid.org/docs/general/AppInclusionPolicy/#ai-policy)
excludes projects containing AI-generated code. This project discloses that
assistance in CONTRIBUTING.md; verify a repository's policy before requesting
inclusion. Do not imply approval or availability before it exists.
