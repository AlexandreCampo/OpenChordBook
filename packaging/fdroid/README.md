# F-Droid packaging

Application ID: `io.github.openchordbook` · License: `GPL-3.0-or-later`

[metadata/io.github.openchordbook.yml](metadata/io.github.openchordbook.yml) is the
submission recipe for https://github.com/AlexandreCampo/OpenChordBook, candidate
`v1.18` / versionCode 19. The tag and a successful public-source build must
exist before submission. Inclusion is not approved by the presence of this file.

## Eligibility and review points

- The entire application builds from public source with FOSS dependencies.
- Web code, fonts and libraries are bundled locally; no tune collections ship.
- Offline reading, chart authoring and folder management require no account,
  iReal Pro installation or network service.
- Native integration adds catalog downloads, a file picker, immersive reading
  and Android Back handling to the offline application.
- `NonFreeNet` is proposed for optional third-party downloads. Reviewers
  decide final labels and may ask about catalog rights and external sources.
- Third-party notices and OFL font provenance are documented in
  [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
- Development includes AI-assisted code; see [CONTRIBUTING.md](../../CONTRIBUTING.md).

Check the current [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/)
and [submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
before sending a contribution. Acceptance is a maintainer decision.

## Signing choice

The recipe currently uses **standard F-Droid signing**: F-Droid builds from
source and signs its APK. That certificate normally differs from direct
upstream releases. Android cannot update an installation signed by another
key; uninstalling deletes its local library. Test different distributions on
separate devices/profiles until update compatibility is established.

To retain the developer key, first publish an upstream signed APK and establish
[reproducible builds](https://f-droid.org/docs/Reproducible_Builds/) in F-Droid's
environment, then configure `Binaries` and `AllowedAPKSigningKeys`. Neither is
claimed or enabled by the current recipe. Make this decision before first
publication; switching signing keys later is disruptive.

## Submit the recipe

1. Review, commit and publish the source with the `v1.18` tag. Follow
   [the release checklist](../../docs/releases.md). Confirm that the permanent
   application ID is unique and uses a namespace appropriate for the project.
2. Fork `https://gitlab.com/fdroid/fdroiddata` under your GitLab account and clone
   that fork separately. Create a `io.github.openchordbook` branch.
3. Copy this repository's `packaging/fdroid/metadata/io.github.openchordbook.yml`
   into the fork's `metadata/` directory. Store descriptions/screenshots remain
   in this app repository under `fastlane/metadata/android/en-US/`.
4. Install current fdroidserver or use the official buildserver environment
   described in the submission guide. From the fdroiddata checkout, run:

```sh
fdroid readmeta
fdroid rewritemeta io.github.openchordbook
fdroid checkupdates --allow-dirty io.github.openchordbook
fdroid lint io.github.openchordbook
fdroid build --latest io.github.openchordbook
```

5. Fix errors and inspect the complete build log. AGP 9.4.1 / Gradle 9.7.1 /
   SDK 36 must be supported by the buildserver; coordinate with packagers if
   a toolchain change is required. Avoid broad scanner exclusions.
6. Commit the recipe in your fdroiddata fork, push the branch, and open a merge
   request to fdroid/fdroiddata. Use [submission.md](submission.md) as a draft,
   replacing its pending build-result entry with the actual log/CI link.
7. Follow CI and answer review questions. After merge, wait for the repository's
   build/sign/index process, then verify the published listing and installation.
   There is no guaranteed acceptance or publication date.

Do not send APK/repository signing keys or passwords to fdroiddata. An optional
public contact email can be added to the metadata if the maintainer chooses.
Automatic updates follow `vMAJOR.MINOR` tags; extend that pattern deliberately
if the project's version naming changes.

## Your own F-Droid-compatible repository

A self-hosted repository can distribute APKs under your existing developer
key without waiting for official inclusion. You maintain its HTTPS hosting,
index signing and update availability. Follow the
[repository setup guide](https://f-droid.org/docs/Setup_an_F-Droid_App_Repo/).

1. In a new **private working directory outside the web root**, run `fdroid init`.
   Keep its generated config and repository key private and securely backed up.
2. Set the public repo URL/name/description. [config.example.yml](config.example.yml)
   shows those public fields; preserve the signing settings created by `fdroid init`.
3. Copy the signed APK to `repo/io.github.openchordbook_19.apk`. Copy this app's
   recipe to `metadata/io.github.openchordbook.yml`, and its fastlane `en-US` folder
   to `metadata/io.github.openchordbook/en-US` in the private work directory.
4. Run `fdroid update` and upload **only `repo/`** to the configured HTTPS URL.
5. Share the repository URL and signing fingerprint/QR code. Add it in an F-Droid
   client and test first installation and a same-key update.
6. For later releases, add the next APK/changelog, regenerate the index and
   upload it. Keep APK and repository signing keys backed up; they are separate keys.

Never host config.yml, the keystore, or the private work directory itself.
Other distribution routes are covered in [releases](../../docs/releases.md).
