# Contributing

OpenChordBook is maintained by Alexandre Campo. Start with the
[development guide](docs/development.md), [test guide](tests/README.md) and
[issue tracker](https://github.com/AlexandreCampo/OpenChordBook/issues).

## Changes and review

Keep pull requests focused. Explain the problem, the resulting behavior and
how you checked it. Test a small phone viewport as well as desktop. Preserve
existing libraries, folder memberships and unfinished chart drafts.

The web app uses plain ES modules and CSS. Keep browser code in `src/`, Android
platform behavior in `android/`, and developer tools in `scripts/`. Avoid new
runtime dependencies unless they solve a clear problem. UI controls should
have accessible labels and work with keyboard navigation.

Run `npm test` after installing the development dependencies. Changes to native
behavior also require Android build/lint and relevant instrumentation checks.
See [tests/README.md](tests/README.md) for the exact commands and prerequisites.
Update user documentation when behavior changes.

## Licensing and provenance

Original contributions are under GPL-3.0-or-later. Keep upstream notices on
third-party code and fonts; document source, license and local modifications.
Do not add downloaded repertoire, private libraries, keystores, credentials,
local build settings, generated APKs or dependency directories to Git.

This project has used AI coding assistance, including generated code.
The maintainer is responsible for reviewing, testing and maintaining releases.
Disclose assistance when relevant to a contribution or distribution policy;
do not describe the project as containing no AI-generated code. Keep the appropriate source credits and license notices.
