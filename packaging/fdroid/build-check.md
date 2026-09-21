# F-Droid build check — 1.18 / 19

Verified on 2026-09-22 (Europe/Brussels) from the public
[`v1.18` tag](https://github.com/AlexandreCampo/OpenChordBook/tree/v1.18),
commit `cd3fcf40e7c8476d81fc350c893c11f2e7092ded`.

The recipe built successfully in the official
`registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie` container:

- Image digest: `sha256:f81172f142454bccb6e198739d40bf3a98a393f09805140c1aa8b49807d0e3b7`.
- fdroidserver revision: `a35fdfddd9c66823987a410566a6101186e39c84`.
- JDK 21; Java source/target 17; Gradle 9.7.1; AGP 9.4.1; SDK 36.
- Metadata parsing, formatting, lint and tag/update detection passed.
- Source and APK scans passed without scanner exclusions.
- Result: `io.github.openchordbook`, version 1.18 / 19; 47 web assets
  match the source, with no packaged tunes.

Commands inside the configured container:

```sh
fdroid readmeta
fdroid rewritemeta io.github.openchordbook
fdroid lint io.github.openchordbook
fdroid checkupdates --allow-dirty io.github.openchordbook
fdroid build --verbose --test --refresh-scanner --scan-binary --no-tarball --stop io.github.openchordbook:19
```

The [upstream CI](https://github.com/AlexandreCampo/OpenChordBook/actions/runs/35663898004)
also passed. The direct release was built from the same public commit, signed
with the existing developer key, inspected and installed successfully as an
update in the Android emulator.

This is a local run of the official build container. F-Droid's GitLab pipeline
and maintainer review remain separate steps. The recipe uses standard F-Droid
signing; cross-distribution reproducibility is not claimed.
