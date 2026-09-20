# Development

## Run the app

The frontend has no build step. With Python 3.10+:

```sh
python3 scripts/serve-web.py
```

The server binds to `127.0.0.1:8001`. Choose another port with `--port`.
Use `--host 0.0.0.0` only when intentionally testing from another device on
your network. Non-localhost HTTP does not provide full PWA/offline features;
use HTTPS for a deployed site. Only public web files are exposed.

## Development tools

For the complete local test suite, install Node.js 22+, Python 3.10+ and a
JDK 17+. Node/Playwright are not runtime or Android-build dependencies.

```sh
npm ci
npx playwright install chromium
npm test
```

On a Linux machine missing browser system libraries, use
`npx playwright install --with-deps chromium`. The pinned dependency and
lockfile make the browser test tooling repeatable.

The test runner starts its own loopback server on an available port and
uses fresh browser contexts. It does not connect to your normal browser or
clear your library. For suites, emulator checks and environment overrides,
see [tests/README.md](../tests/README.md).

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/app.js` | Connects the workspace, reader controls, imports and lifecycle |
| `src/library.js` | Library state, search, grouping and the three workspace tabs |
| `src/storage.js` | IndexedDB transactions, songs, folder memberships and preferences |
| `src/folders.js`, `folder-browser.js`, `folder-tree.js` | Destination selection and folder management |
| `src/editor.js`, `chord-entry.js` | Authored chart form, chord notation and compilation |
| `src/viewer.js` | Adapts the vendored renderer for authored and imported charts |
| `src/import.js`, `chart-safety.js`, `sanitize.js` | Parsing, limits, validation and rendering safety |
| `src/playlist-export.js`, `export-dialog.js` | iReal playlist files, editable chart round trips and export actions |
| `src/discover.js` | Catalog display, optional downloads and import previews |
| `src/native.js` | Asynchronous Android message bridge, cancellation and replies |
| `sw.js` | Same-origin offline application cache |

Browser modules share storage and events; they do not need a framework or
bundle step. The vendored reader/renderer remain classic scripts and retain
a CommonJS boundary for Node tests. Fonts and libraries are bundled locally.

Android's `MainActivity` hosts the local web files through `WebViewAssetLoader`.
`NetworkPolicy` defines URL/origin rules; `PlaylistDownloader` handles bounded,
user-initiated native requests. `PlaylistExport` prepares UTF-8 file content;
Android’s document picker chooses the destination. Gradle copies the root web assets into its
ignored asset directory. Never edit those generated copies.

## Keeping changes consistent

- Update the root web sources; both web deployment and APK builds use them.
- Keep metadata/tune text out of HTML templates unless it has passed the renderer
  sanitizer. Use `textContent` for ordinary labels and text.
- Preserve the catalog-ID boundary: native code must not accept arbitrary URLs.
- Imports must validate before writing, and cancellation must leave the library
  unchanged. Use synthetic charts in tests and screenshots.
- Keep GPL and third-party notices accessible offline in Library → About.
- Follow [release versioning](releases.md) for service-worker/native cache changes.

`.editorconfig` and `.gitattributes` describe formatting and line endings.
Retain upstream formatting in vendored files to make their local changes reviewable.

## Tooling and automation

- `scripts/serve-web.py`: local preview.
- `scripts/export-web.py`: standalone static deployment directory.
- `scripts/export-source.py`: source archive from a clean committed revision.
- `scripts/check.py`: repository, unit, browser and JVM test runner.
- `scripts/capture-store-screenshots.cjs`: real UI with synthetic charts.
- `scripts/build-music-font.py`: reproducible OFL music-font generation; see
  [font provenance](../vendor/css/FONT.md).

The GitHub Actions workflow runs tests and an unsigned Android build on pushes
and pull requests. Actions are pinned to commit hashes, permissions are read-only,
and no release key or deployment credential is required. It does not publish
releases, deploy the website or submit an F-Droid merge request.

Export follows the [iReal Pro chart protocol](https://www.irealpro.com/ireal-pro-custom-chord-chart-protocol/)
and the existing reader’s `irealb` encoding. Non-executable HTML metadata keeps
jazz4all-authored charts editable after import. Folder exports flatten the selected
folder and descendants, including each tune only once.
