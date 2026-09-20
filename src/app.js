// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// jazz4all — one tabbed workspace and a clear page on the music stand.
import './native.js';
import { renderSong } from './viewer.js';
import { readPlaylistFile, readPlaylistURI, savePlaylist } from './import.js';
import { pickFolder } from './folders.js';
import { getSong, getMeta, setMeta, requestPersistentStorage, wipeAll } from './storage.js';
import * as library from './library.js';
import { openExport } from './export-dialog.js';
import * as discover from './discover.js';
import { initEditor, openEditor } from './editor.js';

const $ = (id) => document.getElementById(id);
const state = { currentId: null, currentSong: null, transpose: 0, zoomOffset: 0, loadRequest: 0, queue: [] };
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let explicitTheme = null;

function toast(msg, ms = 3000) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { $('toast').hidden = true; }, ms);
}

function applyTheme() {
  const theme = explicitTheme || (systemTheme.matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  const label = theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode';
  $('btn-theme').setAttribute('aria-label', label);
  $('btn-theme').title = label;
  $('btn-reader-theme').textContent = label;
  $('btn-theme').querySelector('use').setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#20241f' : '#f4f1e9';
  window.jazz4allNative?.setAppearance?.(theme);
}

function applyZoom() {
  // Size to the actual chart, including when the sidebar or stage view changes.
  const width = Math.max(260, Math.min(1400, $('chart-container').clientWidth));
  const base = Math.round((width - 280) * .014 + 9);
  const pt = Math.max(6, Math.min(48, base + state.zoomOffset));
  $('chart-container').style.fontSize = `${pt}pt`;
  $('btn-zoom-reset').textContent = state.zoomOffset === 0 ? 'Fit' : `${state.zoomOffset > 0 ? '+' : ''}${state.zoomOffset}`;
}

let nativeReading = false;
function updateReadingMode() {
  const reading = !!state.currentSong && !document.body.classList.contains('menu-open')
    && !document.querySelector('dialog[open]') && !document.body.classList.contains('is-creating');
  if (reading !== nativeReading) {
    nativeReading = reading;
    window.jazz4allNative?.setReadingMode?.(reading);
  }
}

function updateNavigation() {
  const existing = new Set(library.getAllSongs().map((song) => song.id));
  state.queue = state.queue.filter((id) => existing.has(id));
  const index = state.queue.indexOf(state.currentId);
  $('chart-position').textContent = index >= 0 ? `${index + 1} / ${state.queue.length}` : '';
  $('btn-prev').disabled = $('btn-next').disabled = state.queue.length < 2;
}

function setStageView(enabled) {
  document.body.classList.toggle('stage-view', enabled);
  $('btn-focus').setAttribute('aria-pressed', String(enabled));
  $('btn-focus').setAttribute('aria-label', enabled ? 'Leave stage view' : 'Enter stage view');
  $('btn-focus').title = enabled ? 'Leave stage view (F or Escape)' : 'Stage view (F)';
  library.syncLayout();
  applyZoom();
}

function showEmpty() {
  state.loadRequest++;
  state.currentId = state.currentSong = null;
  state.queue = [];
  document.body.classList.remove('has-song');
  $('chart-container').replaceChildren();
  $('chart-sheet').hidden = $('bottombar').hidden = $('btn-focus').hidden = $('btn-chart-tools').hidden = true;
  $('empty-state').hidden = false;
  $('view-label').textContent = 'an open chord book';
  $('song-title').textContent = 'jazz4all';
  document.title = 'jazz4all — an open chord book';
  setStageView(false);
}

async function loadSong(id, preserveQueue = false) {
  const request = ++state.loadRequest;
  const song = await getSong(id);
  if (!song || request !== state.loadRequest) return;
  clearTimeout(toast.timer);
  $('toast').hidden = true;
  state.currentId = id;
  state.currentSong = song;
  if (!preserveQueue) {
    const list = library.getCurrentList();
    state.queue = (list.some((item) => item.id === id) ? list : library.getAllSongs()).map((item) => item.id);
  }
  document.body.classList.add('has-song');
  state.transpose = 0;
  $('transpose-display').textContent = '0';
  $('song-title').textContent = song.title;
  $('view-label').textContent = 'ON THE MUSIC STAND';
  $('chart-title').textContent = song.title;
  $('chart-composer').textContent = song.composer || 'Composer not listed';
  $('chart-style').textContent = [song.style || 'Chord chart', song.bpm ? `♩ ${song.bpm}` : ''].filter(Boolean).join('  ·  ');
  document.title = `${song.title} — jazz4all`;
  $('empty-state').hidden = true;
  $('chart-sheet').hidden = $('bottombar').hidden = $('btn-focus').hidden = $('btn-chart-tools').hidden = false;
  renderCurrent();
  $('viewport').scrollTop = 0;
  library.setSelected(id);
  updateNavigation();
  updateReadingMode();
  await setMeta('lastSongId', id);
}

function renderCurrent() {
  if (!state.currentSong) return;
  try {
    const rendered = renderSong(state.currentSong, $('chart-container'), { transpose: state.transpose });
    $('chart-key').textContent = rendered.key || state.currentSong.key || '—';
    applyZoom();
  } catch (err) {
    console.error(err);
    $('chart-container').textContent = 'This chart could not be displayed. Try importing another version of the tune.';
    $('chart-key').textContent = state.currentSong.key || '—';
    toast(`Could not display the chart: ${err.message}`, 5000);
  }
}

async function setZoomOffset(delta) {
  state.zoomOffset = delta === null ? 0 : Math.max(-12, Math.min(36, state.zoomOffset + delta));
  applyZoom();
  await setMeta('zoomOffset', state.zoomOffset);
}

function setTranspose(delta) {
  if (!state.currentSong) return;
  state.transpose = delta === null ? 0 : (state.transpose + delta + 12) % 12;
  if (state.transpose > 6) state.transpose -= 12;
  $('transpose-display').textContent = `${state.transpose > 0 ? '+' : ''}${state.transpose}`;
  renderCurrent();
}

function navigate(direction) {
  updateNavigation();
  if (!state.queue.length) return;
  const index = state.queue.indexOf(state.currentId);
  const next = (index + direction + state.queue.length) % state.queue.length;
  $('chart-tools-dialog').close();
  loadSong(state.queue[next], true);
}

async function prepareImport(playlist) {
  const count = playlist.songs.length;
  const result = await pickFolder({
    title: `Import ${count} tune${count === 1 ? '' : 's'}`,
    description: playlist.name,
    initialId: library.getCurrentFolderId(),
    confirmLabel: `Import ${count} tune${count === 1 ? '' : 's'}`,
    onConfirm: ({ folderId }) => savePlaylist(playlist, folderId),
  });
  await library.refresh();
  if (!result) return null;
  library.showFolder(result.folderId);
  library.openDrawer('library');
  toast(`Imported ${count} tune${count === 1 ? '' : 's'} into ${result.folderName}`);
  return result.value;
}

async function handleImportFile(file) {
  $('btn-import-file').disabled = true;
  try { await prepareImport(await readPlaylistFile(file)); }
  catch (error) { toast(`Import failed: ${error.message}`, 6000); }
  finally { $('btn-import-file').disabled = false; }
}

let wakeLock;
async function tryWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || (wakeLock && !wakeLock.released)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* Browser may decline. */ }
}

function wireUI() {
  library.init();
  initEditor();
  const editChart = (song = null) => {
    const opened = openEditor({
      song, folderId: library.getCurrentFolderId(),
      afterSave: async ({ id, folderId, created }) => {
        await library.refresh();
        if (created) library.showFolder(folderId);
        library.activateTab('library');
        await loadSong(id);
        library.closeDrawer();
        toast(created ? 'Chart saved' : 'Changes saved');
      },
    });
    if (opened !== false && song) library.openDrawer('create');
  };
  library.onCreate(() => editChart());
  $('btn-new-chart-empty').addEventListener('click', () => library.openDrawer('create'));
  library.onEdit(editChart);
  document.addEventListener('editorclose', () => library.activateTab('library'));
  window.jazz4allBack = () => {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (dialog) {
      if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
      return true;
    }
    if (document.body.classList.contains('is-creating')) { library.activateTab('library'); return true; }
    if ($('library-drawer').classList.contains('open')) {
      library.closeDrawer();
      return true;
    }
    if (document.body.classList.contains('stage-view')) { setStageView(false); return true; }
    return false;
  };
  library.onSelect(loadSong);
  library.onChange(async (songs) => {
    if (state.currentId && !songs.some((song) => song.id === state.currentId)) {
      if (songs.length) await loadSong(songs[0].id);
      else { showEmpty(); await setMeta('lastSongId', null); }
    }
    updateNavigation();
  });
  discover.onImportRequest(prepareImport);
  document.addEventListener('app-notice', (event) => toast(event.detail, 4500));
  document.addEventListener('readerlayoutchange', updateReadingMode);
  const dialogObserver = new MutationObserver(updateReadingMode);
  document.querySelectorAll('dialog').forEach((dialog) => dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  $('btn-chart-tools').addEventListener('click', () => $('chart-tools-dialog').showModal());
  $('btn-export-chart').addEventListener('click', () => {
    if (state.currentSong) openExport([state.currentSong], state.currentSong.title, 'Current chart · original key');
  });
  $('btn-about').addEventListener('click', () => $('about-dialog').showModal());
  document.querySelectorAll('[data-license]').forEach((details) => {
    details.addEventListener('toggle', async () => {
      if (!details.open || details.dataset.loaded) return;
      const text = details.querySelector('pre');
      text.textContent = 'Loading…';
      try {
        const response = await fetch(details.dataset.license);
        if (!response.ok) throw new Error('License unavailable');
        text.textContent = await response.text();
        details.dataset.loaded = 'true';
      } catch {
        text.textContent = 'Could not load this notice. Close and reopen this section to retry.';
      }
    });
  });
  $('btn-reader-theme').addEventListener('click', () => $('btn-theme').click());

  $('btn-theme').addEventListener('click', async () => {
    explicitTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    await setMeta('theme', explicitTheme);
  });
  systemTheme.addEventListener('change', applyTheme);
  $('btn-focus').addEventListener('click', () => setStageView(!document.body.classList.contains('stage-view')));
  document.addEventListener('stagechange', () => setStageView(false));
  $('btn-transpose-up').addEventListener('click', () => setTranspose(1));
  $('btn-transpose-down').addEventListener('click', () => setTranspose(-1));
  $('transpose-display').addEventListener('click', () => setTranspose(null));
  $('btn-prev').addEventListener('click', () => navigate(-1));
  $('btn-next').addEventListener('click', () => navigate(1));
  $('btn-zoom-in').addEventListener('click', () => setZoomOffset(1));
  $('btn-zoom-out').addEventListener('click', () => setZoomOffset(-1));
  $('btn-zoom-reset').addEventListener('click', () => setZoomOffset(null));
  new ResizeObserver(applyZoom).observe($('chart-sheet'));


  const fileInput = $('file-input');
  const importDialog = $('import-dialog');
  $('btn-import-file').addEventListener('click', () => fileInput.click());
  $('btn-import-empty').addEventListener('click', () => importDialog.showModal());
  $('btn-import-choose-file').addEventListener('click', () => { importDialog.close(); fileInput.click(); });
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) await handleImportFile(file);
    event.target.value = '';
  });
  const openDiscover = () => { importDialog.close(); library.openDrawer('discover'); };
  $('btn-discover-empty').addEventListener('click', openDiscover);
  $('btn-import-discover').addEventListener('click', openDiscover);
  const uriDialog = $('uri-dialog');
  const openURI = () => {
    importDialog.close();
    $('uri-input').value = '';
    $('uri-error').textContent = '';
    uriDialog.showModal();
    $('uri-input').focus();
  };
  $('btn-import-uri').addEventListener('click', openURI);
  $('btn-import-choose-link').addEventListener('click', openURI);
  $('btn-uri-submit').addEventListener('click', async (event) => {
    event.preventDefault();
    if (!$('uri-input').reportValidity()) return;
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Reading playlist…';
    $('uri-error').textContent = '';
    try {
      const playlist = readPlaylistURI($('uri-input').value);
      uriDialog.close();
      const result = await prepareImport(playlist);
      if (!result) uriDialog.showModal();
    } catch (error) {
      if (!uriDialog.open) uriDialog.showModal();
      $('uri-error').textContent = error.message;
    } finally { button.disabled = false; button.textContent = 'Choose folder'; }
  });
  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });

  $('btn-wipe').addEventListener('click', async () => {
    if (!confirm('Delete all songs, playlists and folders on this device? This cannot be undone.')) return;
    await wipeAll();
    showEmpty();
    await setMeta('lastSongId', null);
    await library.refresh();
    toast('Library cleared');
  });

  let dragDepth = 0;
  document.addEventListener('dragenter', (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth++;
    $('drop-hint').hidden = false;
  });
  document.addEventListener('dragover', (event) => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) $('drop-hint').hidden = true;
  });
  document.addEventListener('drop', async (event) => {
    event.preventDefault();
    dragDepth = 0;
    $('drop-hint').hidden = true;
    const file = event.dataTransfer.files[0];
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) return toast('Choose an iRealPro .html playlist file.');
    await handleImportFile(file);
  });

  document.addEventListener('keydown', (event) => {
    if (document.body.classList.contains('is-creating')) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    if (event.key === '/') {
      event.preventDefault();
      library.openDrawer('library');
      $('search-input').focus();
      return;
    }
    if (event.key === 'Escape') { setStageView(false); return; }
    if (event.target.closest('#library-drawer') || !state.currentSong) return;
    const actions = {
      ArrowRight: () => navigate(1), ArrowLeft: () => navigate(-1),
      '+': () => setTranspose(1), '=': () => setTranspose(1), '-': () => setTranspose(-1),
      ']': () => setZoomOffset(1), '[': () => setZoomOffset(-1), '0': () => setZoomOffset(null),
      f: () => setStageView(!document.body.classList.contains('stage-view')),
    };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });
  document.addEventListener('visibilitychange', tryWakeLock);
}

async function init() {
  applyTheme();
  wireUI();
  const [theme, zoom, lastId] = await Promise.all([getMeta('theme'), getMeta('zoomOffset'), getMeta('lastSongId')]);
  explicitTheme = ['light', 'dark'].includes(theme) ? theme : null;
  applyTheme();
  if (typeof zoom === 'number') state.zoomOffset = zoom;
  await library.refresh();
  await library.restoreView();
  const songs = library.getAllSongs();
  if (lastId && songs.some((song) => song.id === lastId)) await loadSong(lastId);
  else if (songs.length) await loadSong(songs[0].id);
  else showEmpty();
  requestPersistentStorage().catch(() => {});
  tryWakeLock();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline setup failed', err));
}
init().catch((err) => { console.error(err); toast(`Could not open your library: ${err.message}`, 6000); });
