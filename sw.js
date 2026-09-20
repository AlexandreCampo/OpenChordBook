// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// jazz4all — service worker
// Strategy: cache-first for the app shell. Songs live in IndexedDB.
// Only same-origin GETs are intercepted — never proxy or cache anything
// cross-origin. Explicit playlist downloads are stored in IndexedDB instead.

const VERSION = 'v23';
const CACHE = `jazz4all-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './LICENSE',
  './COPYRIGHT',
  './THIRD_PARTY_NOTICES.md',
  './PRIVACY.md',
  './licenses/ireal-renderer-MIT.txt',
  './licenses/ireal-reader-MIT.txt',
  './licenses/Bravura-OFL.txt',
  './licenses/Apache-2.0.txt',
  './src/fonts/SourceSans3-LICENSE.md',
  './src/fonts/NotoSerif-LICENSE.txt',

  './manifest.webmanifest',
  './src/app.js',
  './src/native.js',
  './src/chart-safety.js',
  './src/storage.js',
  './src/import.js',
  './src/playlist-export.js',
  './src/export-dialog.js',
  './src/library.js',
  './src/folders.js',
  './src/folder-browser.js',
  './src/folder-tree.js',
  './src/editor.js',
  './src/editor.css',
  './src/chord-entry.js',
  './src/viewer.js',
  './src/sanitize.js',
  './src/discover.js',
  './src/styles.css',
  './src/fonts/JazzSans-Regular.woff2',
  './src/fonts/JazzSans-Semibold.woff2',
  './src/fonts/NotoSerif-Regular.woff2',
  './src/fonts/NotoSerif-Italic.woff2',
  './icons/icon.svg',
  './data/catalog.json',
  './vendor/ireal-reader-tiny.js',
  './vendor/ireal-renderer.js',
  './vendor/css/ireal-renderer.css',
  './vendor/css/JazzMusic.woff',
  './vendor/css/JazzMusic.ttf',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' bypasses the browser HTTP cache so a new app version
    // is never installed from stale 304/cached responses.
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && fresh.type === 'basic') {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      if (req.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
