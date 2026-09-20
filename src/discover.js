// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// jazz4all — Discover tab: curated catalog of community playlists.
//
// Two modes, same catalog:
//  - Web/PWA: direct imports for exports whose host allows browser downloads;
//    otherwise source links for manual .html / irealb:// imports.
//  - Android app: a native bridge (window.jazz4allNative) can fetch a
//    public source page and extract the irealb:// playlist URI from it.
//    Entries with a "scrape" hint get an Add button: one tap fetches the
//    playlist from the source and imports it locally. Fetched URIs are
//    cached in IndexedDB so returning users never re-fetch.
//
// No chart data is shipped or fetched at startup. Downloads begin only on Add.

import { parsePlaylist } from './import.js';
import { getMeta, setMeta } from './storage.js';

let catalog = null;
let onImportRequestCb = async () => null;
let importing = false;
let activeButton = null, activeController = null;

export function cancelDownload() { activeController?.abort(); }

export function onImportRequest(cb) { onImportRequestCb = cb; }

const nativeBridge = () => window.jazz4allNative || null;

async function loadCatalog() {
  if (catalog) return catalog;
  const res = await fetch('data/catalog.json');
  if (!res.ok) throw new Error(`Catalog HTTP ${res.status}`);
  catalog = await res.json();
  return catalog;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else node[k] = v;
  }
  for (const c of children) node.appendChild(c);
  return node;
}

function addLabel(item) {
  return item.songCount ? `Add ${item.songCount} tunes` : 'Add to library';
}

async function downloadExport(url, signal) {
  const source = new URL(url);
  if (source.protocol !== 'https:' || source.hostname !== 'dl.dropboxusercontent.com'
      || source.username || source.password || source.port) throw new Error('Download destination is not permitted.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) controller.abort();
  const timer = setTimeout(cancel, 30000);
  try {
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`Download HTTP ${response.status}. Open the source to check its availability.`);
    const reader = response.body.getReader(), chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 10 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Playlist download is larger than 10 MB.');
      }
      chunks.push(value);
    }
    return await new Blob(chunks).text();
  } catch (error) {
    if (signal.aborted) throw new Error('Download cancelled.');
    if (controller.signal.aborted) throw new Error('Download timed out. Try again or open the source.');
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}

async function handleAdd(btn, item) {
  if (importing) {
    if (btn === activeButton) activeController?.abort();
    return;
  }
  importing = true;
  document.querySelectorAll('.discover-add-btn').forEach((button) => { button.disabled = true; });
  activeButton = btn;
  activeController = new AbortController();
  const signal = activeController.signal;
  btn.textContent = 'Cancel download';
  btn.disabled = false;
  try {
    const cacheKey = 'scrape:' + JSON.stringify([item.scrape.url, item.scrape.name || null]);
    let text = await getMeta(cacheKey);
    const cached = !!text;
    if (!text) {
      text = nativeBridge()
        ? await nativeBridge().fetchPlaylist(item.id, signal)
        : await downloadExport(item.download, signal);
      if (!text) {
        throw new Error('No playlist found on the source page — open the thread to import manually.');
      }
      if (text.startsWith('ERROR: ')) throw new Error(text.slice(7));
    }
    if (signal.aborted) throw new Error('Download cancelled.');
    activeController = null;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const playlist = parsePlaylist(text, item.title);
    if (!cached) await setMeta(cacheKey, text);
    const result = await onImportRequestCb(playlist);
    btn.textContent = result ? 'Added' : addLabel(item);
    btn.classList.toggle('added', !!result);
    btn.disabled = !!result;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = addLabel(item);
    document.dispatchEvent(new CustomEvent('app-notice', { detail: `Import failed: ${err.message}` }));
  } finally {
    importing = false;
    activeButton = null;
    activeController = null;
    document.querySelectorAll('.discover-add-btn').forEach((button) => { button.disabled = button.classList.contains('added'); });
  }
}

function renderItem(item) {
  const card = el('div', { class: 'discover-item' });
  const link = el('a', {
    href: item.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    class: 'discover-item-main',
  });
  const titleRow = el('div', { class: 'discover-item-title' });
  titleRow.appendChild(el('span', { text: item.title, class: 'discover-item-name' }));
  if (item.songCount) {
    titleRow.appendChild(el('span', {
      text: `${item.songCount} tunes`,
      class: 'discover-item-count',
    }));
  }
  link.appendChild(titleRow);
  link.appendChild(el('div', { text: item.source, class: 'discover-item-source' }));
  if (item.description) {
    link.appendChild(el('div', { text: item.description, class: 'discover-item-desc' }));
  }
  card.appendChild(link);
  if (item.scrape && (nativeBridge() || item.download)) {
    const btn = el('button', { class: 'discover-add-btn', text: addLabel(item), disabled: importing });
    btn.addEventListener('click', () => handleAdd(btn, item));
    card.appendChild(btn);
  }
  return card;
}

function renderCategory(cat) {
  const details = el('details', { class: 'discover-category' });
  if (cat.id === 'gypsy-jazz') details.open = true; // user's primary repertoire
  const summary = el('summary', { class: 'discover-category-summary' });
  summary.appendChild(el('span', { text: cat.name, class: 'discover-category-name' }));
  summary.appendChild(el('span', {
    text: `${cat.items.length}`,
    class: 'discover-category-count',
  }));
  details.appendChild(summary);
  if (cat.description) {
    details.appendChild(el('div', { text: cat.description, class: 'discover-category-desc' }));
  }
  for (const item of cat.items) details.appendChild(renderItem(item));
  return details;
}

export async function init(container) {
  container.innerHTML = '';
  const intro = el('div', { class: 'discover-intro' });
  intro.appendChild(el('h2', { text: 'A world of tunes.' }));
  intro.appendChild(el('p', {
    text: nativeBridge()
      ? 'Find your repertoire in community collections. Tap Add, choose a folder, and save a playlist for offline practice.'
      : 'Tap Add to save a collection in a folder. For other collections, open the source and import its .html playlist or iRealPro link below.',
    class: 'discover-intro-text',
  }));
  container.appendChild(intro);
  const search = el('input', { type: 'search', class: 'discover-search', placeholder: 'Search genres or collections…' });
  search.setAttribute('aria-label', 'Search community collections');
  container.appendChild(search);
  const results = el('div');
  container.appendChild(results);

  try {
    const data = await loadCatalog();
    const renderResults = () => {
      const query = search.value.trim().toLowerCase();
      results.replaceChildren();
      let found = 0;
      for (const cat of data.categories) {
        const matchesCategory = `${cat.name} ${cat.description || ''}`.toLowerCase().includes(query);
        const items = matchesCategory ? cat.items : cat.items.filter((item) =>
          `${item.title} ${item.description || ''} ${item.source}`.toLowerCase().includes(query));
        if (!items.length) continue;
        found += items.length;
        const section = renderCategory({ ...cat, items });
        if (query) section.open = true;
        results.appendChild(section);
      }
      if (!found) results.appendChild(el('p', { class: 'no-results', text: 'No collections found. Try a genre like swing or bossa.' }));
    };
    search.addEventListener('input', () => { cancelDownload(); renderResults(); });
    renderResults();
    if (data.updated) {
      const footer = el('div', {
        text: `Catalog updated ${data.updated}`,
        class: 'discover-footer',
      });
      container.appendChild(footer);
    }
  } catch (err) {
    container.appendChild(el('p', {
      text: `Couldn't load catalog: ${err.message}`,
      class: 'discover-error',
    }));
  }
}
