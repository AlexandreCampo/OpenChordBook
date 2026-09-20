# Third-party notices

jazz4all: Copyright © 2026 Alexandre Campo, GNU GPL-3.0-or-later.
The complete license is in LICENSE. This notice and all license texts
are bundled in the APK and available offline from Library → About.

## iReal renderer and parser — MIT

vendor/ireal-renderer.js, vendor/ireal-reader-tiny.js and
vendor/css/ireal-renderer.css derive from ireal-renderer by Michael Daumling.
Copyright (c) 2017 Michael Daumling.
Source: https://github.com/daumling/ireal-renderer
License: licenses/ireal-renderer-MIT.txt

The reader also derives from ireal-reader by Florin Alexandrescu.
Source: https://github.com/pianosnake/ireal-reader
Its README and package.json declare MIT (no separate upstream LICENSE file).
License: licenses/ireal-reader-MIT.txt

Local changes include parser improvements, playlist export support and the music-font
reference. These files retain MIT licensing; modifications copyright
2026 Alexandre Campo. No proprietary iReal Pro application code is included.

## Jazz Music — SIL Open Font License 1.1

vendor/css/JazzMusic.ttf and JazzMusic.woff are built from Bravura and
Noto Serif. Copyright 2026 Steinberg Media Technologies GmbH; copyright
2022 The Noto Project Authors; modifications copyright 2026 Alexandre Campo.
The modified font is renamed Jazz Music to respect Bravura's reserved name.
Licenses: licenses/Bravura-OFL.txt and src/fonts/NotoSerif-LICENSE.txt.
Sources, verified input checksum and rebuild instructions: vendor/css/FONT.md.

The previous iRealFont binaries are removed. None of their glyph outlines,
including the OPTI Century Schoolbook material of unclear license, is used
in Jazz Music. Only the renderer's code-point contract and layout dimensions
are preserved. Music symbols come from Bravura, N.C./D.S. from Noto Serif.

## Interface fonts — SIL Open Font License 1.1

Jazz Sans is a renamed subset of Adobe Source Sans 3, regular and semibold.
Copyright 2023 Adobe, with Reserved Font Name “Source”.
Source: https://github.com/adobe-fonts/source-sans
License: src/fonts/SourceSans3-LICENSE.md

Noto Serif regular and italic are Latin subsets.
Copyright 2022 The Noto Project Authors.
Source: https://github.com/notofonts/latin-greek-cyrillic
License: src/fonts/NotoSerif-LICENSE.txt

## Android libraries and build tools — Apache License 2.0

The Android wrapper uses AndroidX Core 1.17.0 and WebKit 1.14.0, with
their transitive AndroidX, Kotlin and JetBrains annotation dependencies.
Copyright their respective Android Open Source Project, Google, JetBrains
and contributing authors. The dependency artifacts retain their own notices.
Sources: https://android.googlesource.com/platform/frameworks/support/
and https://github.com/JetBrains/kotlin
License: licenses/Apache-2.0.txt

The Gradle wrapper is distributed under Apache 2.0 (copyright Gradle, Inc.).
Source: https://github.com/gradle/gradle
Android Gradle Plugin source: https://android.googlesource.com/platform/tools/base/
Build-time tools are not application features or network services.

## Artwork, sample material and external content

The application's icons, interface illustrations and store screenshots are
covered by jazz4all's GPL-3.0-or-later notice. Store screenshots use synthetic
practice charts prepared for this project, not downloaded repertoire.

Tunes are not packaged with the app; they are downloaded by the user.
The application license does not cover imported music.

iReal Pro is a name used by Technimo LLC. jazz4all is unaffiliated with
Technimo and does not require the iReal Pro app.
