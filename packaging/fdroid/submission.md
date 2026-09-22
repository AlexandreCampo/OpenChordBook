OpenChordBook is an offline chord chart reader and editor for musicians, with transposition, folders, chart import/export, named sections, mixed meters and repeats. Android 7.0 or later.

- Author: Alexandre Campo.
- Source: https://github.com/AlexandreCampo/OpenChordBook
- Issues/contact: https://github.com/AlexandreCampo/OpenChordBook/issues
- Release: [v1.18](https://github.com/AlexandreCampo/OpenChordBook/releases/tag/v1.18), versionCode 19, commit `cd3fcf40e7c8476d81fc350c893c11f2e7092ded`.
- License: GPL-3.0-or-later.

No tunes are packaged; users download or import their own. Optional third-party downloads are disclosed as `NonFreeNet`. The app works offline, with no accounts, advertising or analytics. The Android shell provides file selection/export, downloads, immersive reading and Back navigation. Third-party notices, font provenance and AI-assisted development are documented upstream.

## Checklist

### Policy

* [x] The app complies with the [inclusion criteria](https://f-droid.org/docs/Inclusion_Policy).
* [x] The original app author has been notified (and does not oppose the inclusion). If you are not the author, please paste the link of the reply from the author.

  I am Alexandre Campo, the app author.
* [x] The upstream app source code repo contains the app metadata in a [Fastlane](https://gitlab.com/snippets/1895688) or [Triple-T](https://gitlab.com/snippets/1901490) folder structure. The summary and description must be included and images, icon, and changelog should also be provided for better user experience. The `en-US` locale must be included.

### Docs

* [x] Please read [the guide](https://gitlab.com/fdroid/fdroiddata/-/blob/master/CONTRIBUTING.md) first if this is your first contribution.
* [x] Please make sure your metadata follows the best practice in [our templates](https://gitlab.com/fdroid/fdroiddata/tree/master/templates).
* [x] Please read the [Build Metadata Reference](https://f-droid.org/docs/Build_Metadata_Reference/) and make sure your metadata is valid.
* [x] Please read the [Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/).

### Merge Request Setup

* [x] The title of this merge request should follow "New app: app name" format.
* [x] Please make sure your fdroiddata fork is public and your branch is not protected. See <https://docs.gitlab.com/user/project/repository/branches/protected/>.
* [x] Please read [our Git guide](https://gitlab.com/fdroid/wiki/-/wikis/Tips-for-fdroiddata-contributors/Git-Usage) if you don't know how to rebase your branch. Don't rebase your branch if there is no conflict.

  No rebase is needed; the existing branch has no merge conflict.
* [x] All related [fdroiddata](https://gitlab.com/fdroid/fdroiddata/issues) and [RFP issues](https://gitlab.com/fdroid/rfp/issues) have been referenced in this merge request

  No related issues are known.
* [x] Please only submit one app in one MR.

### Metadata

* [x] Metadata must be put in `metadata/<applicationId>.yml`.
* [x] Metadata must be a valid YAML file.
* [x] Metadata must use LF as line ending.
* [x] Don't add summary/description/changelog/images or anything that should be provided in upstream repo. Please check the Changes tab to make sure there is no other unrelated files added in the MR.
* [x] Releases are tagged and auto update is enabled unless there is a special reason.
* [x] There is an issue tracker and contact info of the author so that we can report bugs and contact the author.
* [x] An AuthorName must be added. It doesn't need to be the real name.
* [x] External repos are added as git submodules instead of srclibs. You can update git submodules without opening an MR in this repo and the submodule is covered by our scanner.

  No external application repositories or submodules are used. The build recipe uses F-Droid's standard `reproducible-apk-tools` srclib, at version `v0.3.0`, solely to reproduce the ZIP alignment added by apksigner 36. It is not packaged in the app.
* [x] Enable [Reproducible Builds](https://f-droid.org/docs/Reproducible_Builds). We'll use your signature for improved security/reliability, also allowing users to switch between different channels. Do note that if you don't enable reproducible build then the apk will be signed with our key so you can't enable it later. If you can't enable this, please add the reasons here.

  A replacement v1.18 APK built with Java 21 has been verified locally in the official `buildserver-trixie` container using `reproducible-apk-tools@v0.3.0`. The separate F-Droid build and source/APK scans pass. Signature copying, Android signature verification and an explicit certificate check produce a byte-identical APK: SHA-256 `0990a2c3fd4e7d2f9e433423dbb5daeee5db77c0c95b8549682d0a5a90153fa8`. The local test used the unpublished candidate directly; the final recipe retains `Binaries` and `AllowedAPKSigningKeys`. The replacement APK/checksums still await publication. The tag, source, version and signing key are unchanged.

* [x] Setup abi split if the APK is large and the splitted ones can be much smaller.

  Not applicable: the universal APK is about 2 MiB and contains no native libraries.
* [x] Only the latest versions should be kept in the metadata before it's merged. If you update the metadata, please replace the old versions with the new ones.
* [x] Don't add any disabled versions in the metadata.
* [x] The `commit` field should be the full hash. Please don't use tag or branch in commit.

### Pipeline

* [ ] All pipelines should pass.

  Local Java 21 build and reproducibility checks pass. Public CI must be rerun after the replacement APK/checksums are published. The reviewer’s existing recipe can remain unchanged. The earlier passing pipeline predates this change.
* [ ] All warnings and errors in the Reports tab should be fixed or explained.

  The six Code Quality findings from the passing pipeline are explained below. Local build warnings concern deprecated Gradle and Android APIs; the local build and scanners pass. Reports from the next pipeline must be reviewed before checking this item.
* [x] F-Droid CI runners are under GitLab's FOSS program, so there's no need for you to pay for any CI time. If Gitlab starts asking for phone numbers or credit cards don't submit anything, just leave a note in the MR so we know we need to trigger the CI.

  The fork pipeline ran successfully; no paid CI is needed.

### Code Quality findings

- **Permission `android.permission.INTERNET` (Minor):** required for optional, user-initiated playlist downloads. Reading, editing and organizing downloaded charts work offline.
- **No R8 marker (Minor):** release code shrinking is disabled (`isMinifyEnabled = false`). The APK is about 2 MiB; shrinking is optional and its absence is expected.
- **Signed APK (Info):** a link to the CI-generated test artifact. This is informational; the reproducibility recipe verifies the developer-signed GitHub release.
- **`io.github.openchordbook.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (Info):** a signature-level permission generated by AndroidX Core to protect its non-exported dynamic receivers. It is not a user-granted runtime permission.
- **No native libraries, 2.0 MiB (Info):** confirms the small universal APK; ABI splits would not reduce its size.
- **Fastlane/Triple-T metadata in `en-US` (Info):** confirms that the summary, title, description, changelog, five screenshots and icon were found.
