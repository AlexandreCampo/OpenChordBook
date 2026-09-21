# Web deployment

The web version is a standalone static application. It has no server-side API,
account service, runtime CDN or JavaScript build step.

## Export only the public files

From the repository root:

```sh
python3 scripts/export-web.py
```

This writes `dist/web/`: the HTML, JavaScript, CSS, fonts, icons, catalog metadata
and complete legal notices. It excludes Git, Android, tests, tooling, development
dependencies and private settings. An existing non-empty destination is refused
so a deployment cannot silently inherit stale or private files. Choose a new
output directory for a later build, for example:

```sh
python3 scripts/export-web.py dist/web-next
```

Upload the **contents of that export** to your HTTPS static host. Do not deploy
the entire development checkout. The app uses relative asset paths and supports
a subdirectory such as `/openchordbook/`; keep the exported directory structure intact.
A GitHub Pages deployment can use this export as its artifact. Hosting/Pages
settings are a maintainer choice; this repository does not automatically deploy.

## Installation and offline storage

Open the HTTPS site, then use the browser's Install app / Add to Home Screen
option. The first successful visit caches the application shell. Songs, folders
and preferences live in IndexedDB. Browser and native Android installations
have separate storage; there is no synchronization or automatic backup.

Keep the same hosting origin when updating an existing installation. Moving
to another hostname or protocol creates a separate browser storage origin.
Bump the cache version in `sw.js` when releasing changed app assets. Avoid
long-lived caching headers on `sw.js`; a browser must be able to detect updates.

Web Share Target POST imports are not implemented. The manifest intentionally
does not register a share target. Import through Discover's file/link actions.

## Check the deployed app

Serve over HTTPS with the correct JavaScript, CSS and font content types.
Open the page, import a practice chart and try an offline reload. Check the
reader, editor, folder picker and export on both a phone viewport and desktop.
