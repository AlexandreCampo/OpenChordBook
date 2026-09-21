# New App: OpenChordBook (io.github.openchordbook)

OpenChordBook is an offline chord chart reader and editor for musicians, with
transposition, nested folders, named sections, mixed meters and repeat bars.

- Maintainer: Alexandre Campo
- Source: https://github.com/AlexandreCampo/OpenChordBook
- Issues: https://github.com/AlexandreCampo/OpenChordBook/issues
- Candidate tag: `v1.17` (versionCode 18)
- License: GPL-3.0-or-later; third-party MIT, OFL and Apache notices preserved
- Build/CI result: **PENDING — replace with the successful public-tag build log**
- Signing: standard F-Droid signing; no reproducibility claim

The complete offline application is bundled locally. Android integration
includes catalog-bound downloads, native file selection, immersive reading
and Back navigation. No iReal Pro installation is required. Android 7.0+.

No tunes are packaged. Optional community downloads use third-party services,
so NonFreeNet is proposed for review. No accounts, ads, analytics or tracking
SDKs. Internet is the only device capability permission requested. No incoming
URI handler, arbitrary native URL fetcher or Google Play Services dependency.

Fastlane metadata contains descriptions, icon, synthetic-chart screenshots
and the changelog. THIRD_PARTY_NOTICES.md documents source/font provenance;
the OFL music font includes verified inputs and a rebuild script. PRIVACY.md
explains local storage and optional third-party network requests.

Development includes AI-assisted code, disclosed in CONTRIBUTING.md.
Please review the proposed anti-feature labeling and buildserver support for
AGP 9.4.1, Gradle 9.7.1, SDK 36 and Java 17 source/target. No private signing
configuration is required to build the app.
