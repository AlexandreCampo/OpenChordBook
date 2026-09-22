# F-Droid build check — 1.18 / 19

The Java 21 replacement candidate was verified locally on 2026-09-22 from the
unchanged public [v1.18 tag](https://github.com/AlexandreCampo/OpenChordBook/tree/v1.18),
commit `cd3fcf40e7c8476d81fc350c893c11f2e7092ded`.

## Build environment

- Official image: `registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie`.
- Image digest: `sha256:f81172f142454bccb6e198739d40bf3a98a393f09805140c1aa8b49807d0e3b7`.
- fdroidserver revision: `a35fdfddd9c66823987a410566a6101186e39c84`.
- OpenJDK 21.0.12.1; Java source/target 17; Gradle 9.7.1; AGP 9.4.1; SDK 36.
- Standard `reproducible-apk-tools@v0.3.0` for apksigner 36 ZIP padding.
- No additional JDK installation or Java selection override in the local recipe.

## Reproducibility

A fresh upstream tag checkout built and passed lint. A separate F-Droid checkout
passed the source build and source/APK scans using:

```sh
fdroid build --verbose --test --refresh-scanner --scan-binary --no-tarball --stop io.github.openchordbook:19
```

The final public recipe passed schema, formatting and lint checks. Because the
replacement APK is not published yet, the local build temporarily omitted the
reference URL and signer field. After building, F-Droid's unmodified signature
copier copied the candidate's public signature onto the independent APK.
Android signature verification, the expected-certificate assertion and a full
byte comparison all passed:

```text
Candidate SHA-256: 0990a2c3fd4e7d2f9e433423dbb5daeee5db77c0c95b8549682d0a5a90153fa8
Signer SHA-256:    5a0b2be71342089e1eddef9d478914dbe3115d3a8390791a11daec89f730aaea
Source SHA-256:    4c1f6a85bbe22a1b113ba3a34479777cb9c35df11bc1644b7089045002675a8f
```

The final recipe retains `Binaries` and `AllowedAPKSigningKeys`. No private key
was used for the independent rebuild or comparison. A second upstream build
through `scripts/build-release.sh` produced the same unsigned APK; the helper
also correctly refused a non-21 compiler.

The source archive is unchanged and matches `git archive` of the release tag.
Compared with the previously published APK, the only changed non-signature
entries are `classes.dex` and `assets/dexopt/baseline.prof`. All 47 web assets
match the source; no tunes are packaged.

## Runtime checks

The full suite was rerun after resuming the laptop:

- All five JavaScript unit suites and all nine browser suites pass. They cover
  chart creation/editing, sections, mixed meters, repeats, folder hierarchy and
  membership, file/link imports, individual/selected/folder exports, reader
  controls, auto-fit, rotation, mobile/desktop layouts and offline persistence.
- All three repository checks pass, including documentation links and web export.
- 79 native JVM checks pass under Java 21.
- 37 Android integration checks pass in the isolated test package on API 36.
- Both APK inspection scripts pass.
- Lint reports zero errors and four existing SDK/dependency advisories.
- The signed APK was exercised through Android's actual UI: chart creation,
  mixed meters, preview, saving into a folder, transposition, size controls,
  previous/next, system Save as and file re-import with editable data retained.
- Installing the original Java 25 APK and then the Java 21 candidate without
  uninstalling preserves both synthetic charts and their folder. The candidate
  also passes a cold start, transposition and navigation in airplane mode;
  emulator connectivity was restored afterwards.
- Android runtime checks used an API 36 emulator. Other Android versions and
  physical phones were not tested during this verification.

## Existing merge request

The reviewer’s recipe in MR 49670 at commit
`8b5c88b25c8b55707c0610ea89aa4b1d0728d815` can remain unchanged. It uses the
same release source, Gradle properties, helper version and alignment commands.
The failed job selected Java 21; its remaining Java 25 installation does not
select that compiler. The local recipe omits that unused installation and has
updated explanatory notes. These cleanups do not require another MR commit.

## Publication status

The candidate and logs are in the ignored `dist/releases/v1.18-java21/` directory.
The previously published APK is preserved locally in `dist/releases/v1.18/`.
The tag, application ID, version code and signing key are unchanged.

Replacing the GitHub APK/checksum assets requires approval. Afterwards, rerun
the existing F-Droid pipeline with its current recipe. The candidate has not
yet been verified by downloading it from the public release URL. Maintainer
review and publication remain separate steps.
