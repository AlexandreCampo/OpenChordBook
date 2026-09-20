// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Folder navigation, tune selection and organization. Folder views show direct
// members; subfolders are separate rows. Existing multi-folder memberships stay.
import { listSongs, listFolders, listPlaylists, deleteSong, fileSongs, getMeta, setMeta } from './storage.js';
import { folderLabel, pickFolder } from './folders.js';
import { browseFolders } from './folder-browser.js';
import * as discover from './discover.js';
import { openExport } from './export-dialog.js';
import { songsInFolder } from './playlist-export.js';
const $ = (id) => document.getElementById(id);
let allSongs = [], folders = [], filtered = [], playlistNames = new Map();
let currentFolder = 'all', selectedId = null, groupByTitle = false, selectMode = false;
let selectedIds = new Set(), expandedGroups = new Set(), addingTo = null;
let discoverReady = false, onSelectCb = () => {}, onChangeCb = () => {}, onEditCb = () => {}, onCreateCb = () => {};

function notify(message) { document.dispatchEvent(new CustomEvent('app-notice', { detail: message })); }
function action(fn) { return (...args) => Promise.resolve().then(() => fn(...args)).catch((error) => notify(error.message)); }
const realFolder = () => folders.find((folder) => folder.id === currentFolder) || null;
export function onSelect(cb) { onSelectCb = cb; }
export function onEdit(cb) { onEditCb = cb; }
export function onCreate(cb) { onCreateCb = cb; }
export function onChange(cb) { onChangeCb = cb; }
export function getAllSongs() { return allSongs.slice(); }
export function getCurrentList() { return filtered.slice(); }
export function getCurrentFolderId() { return realFolder()?.id || null; }

export function syncLayout() {
  const visible = !document.body.classList.contains('stage-view') && $('library-drawer').classList.contains('open');
  $('library-drawer').inert = !visible;
  $('library-drawer').setAttribute('aria-hidden', String(!visible));
  const modal = visible;
  $('scrim').hidden = !modal;
  $('workspace').inert = modal;
  $('btn-library').setAttribute('aria-expanded', String(visible));
  document.body.classList.toggle('menu-open', modal);
  document.dispatchEvent(new Event('readerlayoutchange'));
}

export function openDrawer(tab) {
  if (typeof tab === 'string') activateTab(tab);
  document.body.classList.remove('stage-view');
  document.dispatchEvent(new Event('stagechange'));
  $('library-drawer').classList.add('open');
  syncLayout();
  $('btn-close-library').focus();
}

export function closeDrawer() {
  discover.cancelDownload();
  if (document.body.classList.contains('is-creating')) activateTab('library');
  $('library-drawer').classList.remove('open');
  syncLayout();
  $('btn-library').focus();
}

export async function refresh() {
  const [songs, items, playlists] = await Promise.all([listSongs(), listFolders(), listPlaylists()]);
  allSongs = songs;
  folders = items;
  playlistNames = new Map(playlists.map((playlist) => [playlist.id, playlist.name]));
  if (!['all', 'folders', 'unfiled'].includes(currentFolder) && !realFolder()) currentFolder = 'all';
  selectedIds = new Set([...selectedIds].filter((id) => songs.some((song) => song.id === id)));
  applyFilter();
  await onChangeCb(allSongs);
}

export async function restoreView() {
  const [folder, grouped] = await Promise.all([getMeta('lastFolder'), getMeta('groupByTitle')]);
  if (folder && (['all', 'unfiled'].includes(folder) || folders.some((f) => f.id === folder))) currentFolder = folder;
  groupByTitle = !!grouped;
  applyFilter();
}

export function showFolder(id) {
  currentFolder = id === 'folders' ? 'all' : id || 'unfiled';
  selectMode = false;
  addingTo = null;
  selectedIds.clear();
  $('search-input').value = '';
  applyFilter();
  $('library-browser').scrollTop = 0;
  setMeta('lastFolder', currentFolder).catch((error) => notify(error.message));
}

function applyFilter() {
  const query = $('search-input').value.trim().toLocaleLowerCase();
  let songs = allSongs;
  if (currentFolder === 'unfiled') songs = songs.filter((song) => !(song.folderIds || []).length);
  else if (realFolder()) songs = songs.filter((song) => (song.folderIds || []).includes(currentFolder));
  filtered = songs.filter((song) => !query || [song.title, song.composer, ...(song.tags || [])].some((value) => value?.toLocaleLowerCase().includes(query)));
  render();
}

function render() {
  const focusedSong = document.activeElement?.dataset.songId;
  renderFolders();
  renderList();
  renderSelection();
  $('library-total').textContent = allSongs.length;
  $('song-count').textContent = `${filtered.length} tune${filtered.length === 1 ? '' : 's'}`;
  $('btn-wipe').hidden = allSongs.length === 0;
  $('btn-select').disabled = filtered.length === 0 && !selectMode;
  $('btn-select').setAttribute('aria-pressed', String(selectMode));
  $('btn-select').textContent = selectMode ? 'Cancel' : 'Select';
  $('btn-group-toggle').setAttribute('aria-pressed', String(groupByTitle));
  $('btn-group-toggle').classList.toggle('on', groupByTitle);
  $('btn-group-toggle').hidden = selectMode;
  $('tune-list-label').textContent = realFolder() ? 'Tunes in this folder' : 'Tunes';
  const empty = !filtered.length;
  $('library-empty').hidden = !empty;
  $('library-empty').querySelector('h3').textContent = $('search-input').value.trim() ? 'No matching tunes' : realFolder() ? 'No tunes in this folder' : currentFolder === 'unfiled' ? 'No unfiled tunes' : 'No tunes yet';
  $('library-empty').querySelector('p').textContent = $('search-input').value.trim() ? 'Try another title or composer.' : realFolder() ? 'Import a playlist here, or choose tunes from your library.' : 'Open Discover to import a playlist.';
  $('btn-empty-add').hidden = !realFolder() || !allSongs.length || !!$('search-input').value.trim();
  if (focusedSong) [...$('song-list').querySelectorAll('[data-song-id]')].find((el) => el.dataset.songId === focusedSong)?.focus({ preventScroll: true });
}

function renderFolders() {
  $('search-input').placeholder = realFolder() ? 'Search this folder…' : 'Find a tune or composer…';
  const path = realFolder() ? `Library / ${folderLabel(folders, currentFolder)}` : currentFolder === 'unfiled' ? 'Library / Unfiled' : 'Library / All tunes';
  $('folder-breadcrumb').textContent = path;
  $('folder-breadcrumb').title = path;
  $('btn-folder-add-tunes').hidden = !realFolder() || !allSongs.length;
}

function baseTitle(title) { return (title || '').split('/')[0].split('(')[0].toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }
function songMeta(song) { return [song.composer, song.style].filter(Boolean).join(' · '); }
function songRow(song, version = false) {
  const li = document.createElement('li');
  li.className = 'tune-row' + (version ? ' version-row' : '');
  const button = document.createElement('button');
  button.className = 'song-row';
  button.dataset.songId = song.id;
  if (selectMode) button.setAttribute('aria-pressed', String(selectedIds.has(song.id)));
  else if (song.id === selectedId) button.setAttribute('aria-current', 'true');
  button.innerHTML = '<span class="song-list-title"></span><span class="song-list-meta"></span>' + (selectMode ? '<span class="select-box" aria-hidden="true"></span>' : '<span class="song-key"></span>');
  button.querySelector('.song-list-title').textContent = song.title;
  button.querySelector('.song-list-meta').textContent = [songMeta(song), version ? playlistNames.get(song.playlistId) : null].filter(Boolean).join(' · ');
  if (!selectMode) button.querySelector('.song-key').textContent = song.key || '—';
  button.classList.toggle('selected', selectedIds.has(song.id));
  button.onclick = () => {
    if (selectMode) {
      if (selectedIds.has(song.id)) selectedIds.delete(song.id); else selectedIds.add(song.id);
      render();
    } else {
      selectedId = song.id;
      render();
      onSelectCb(song.id);
      closeDrawer();
    }
  };
  li.append(button);
  if (!selectMode) {
    if (song.chartSource?.version === 1) {
      const edit = document.createElement('button');
      edit.className = 'icon-btn tune-edit';
      edit.setAttribute('aria-label', `Edit chart ${song.title}`);
      edit.title = 'Edit chart';
      edit.innerHTML = '<svg aria-hidden="true"><use href="#i-edit"/></svg>';
      edit.onclick = action(() => onEditCb(song));
      li.append(edit);
    }
    const organize = document.createElement('button');
    organize.className = 'icon-btn tune-organize';
    organize.setAttribute('aria-label', `Organize ${song.title}`);
    organize.innerHTML = '<svg aria-hidden="true"><use href="#i-folder"/></svg>';
    organize.onclick = action(() => organizeSongs([song.id]));
    li.append(organize);
  }
  return li;
}

function renderList() {
  const list = $('song-list');
  list.replaceChildren();
  if (!groupByTitle || selectMode) { filtered.forEach((song) => list.append(songRow(song))); return; }
  const groups = new Map();
  for (const song of filtered) { const key = baseTitle(song.title); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(song); }
  for (const [key, songs] of groups) {
    if (songs.length === 1) { list.append(songRow(songs[0])); continue; }
    const li = document.createElement('li'), button = document.createElement('button');
    button.className = 'song-row group-row';
    button.dataset.songId = `group:${key}`;
    button.setAttribute('aria-expanded', String(expandedGroups.has(key)));
    button.innerHTML = '<span class="song-list-title"></span><span class="group-badge"></span><span class="song-list-meta"></span>';
    button.querySelector('.song-list-title').textContent = songs[0].title;
    button.querySelector('.group-badge').textContent = `${songs.length} versions`;
    button.querySelector('.song-list-meta').textContent = songMeta(songs[0]);
    button.onclick = () => { if (expandedGroups.has(key)) expandedGroups.delete(key); else expandedGroups.add(key); render(); };
    li.append(button);
    list.append(li);
    if (expandedGroups.has(key)) songs.forEach((song) => list.append(songRow(song, true)));
  }
}

function renderSelection() {
  $('select-bar').hidden = !selectMode;
  $('select-count').textContent = `${selectedIds.size} selected`;
  $('btn-to-folder').textContent = addingTo ? `Add to ${folders.find((f) => f.id === addingTo)?.name || 'folder'}` : 'Add to folder';
  $('btn-move-folder').hidden = $('btn-delete-songs').hidden = !!addingTo;
  $('btn-remove-from-folder').hidden = !realFolder() || !!addingTo;
  for (const id of ['btn-move-folder', 'btn-to-folder', 'btn-delete-songs', 'btn-remove-from-folder', 'btn-export-selected']) $(id).disabled = !selectedIds.size;
  $('btn-export-folder').disabled = !songsInFolder(allSongs, folders, currentFolder).length;
  $('btn-export-folder').hidden = selectMode;
}

async function organizeSongs(ids, mode = 'move') {
  if (!ids.length) return;
  const result = await pickFolder({
    title: ids.length === 1 ? 'Organize tune' : `Organize ${ids.length} tunes`,
    description: ids.length === 1 ? allSongs.find((song) => song.id === ids[0])?.title || '' : 'Choose where these tunes belong.',
    initialId: realFolder()?.id || allSongs.find((song) => song.id === ids[0])?.folderIds?.[0] || null, organize: true, mode,
    onConfirm: ({ folderId, mode }) => fileSongs(ids, folderId, mode),
  });
  // A folder may have been created even if the destination choice was cancelled.
  await refresh();
  if (!result) return;
  showFolder(result.folderId);
  notify(`${ids.length} tune${ids.length === 1 ? '' : 's'} saved in ${result.folderName}`);
}

function finishSelection() {
  if (addingTo) showFolder(addingTo);
  else { selectMode = false; selectedIds.clear(); render(); }
}

export function activateTab(name) {
  if (name !== 'discover') discover.cancelDownload();
  for (const tab of ['library', 'discover', 'create']) {
    $(`tab-${tab}`).setAttribute('aria-selected', String(tab === name));
    $(`tab-${tab}`).tabIndex = tab === name ? 0 : -1;
    $(`tab-panel-${tab}`).hidden = tab !== name;
  }
  document.body.classList.toggle('is-creating', name === 'create');
  if (name === 'discover' && !discoverReady) { discoverReady = true; discover.init($('discover-content')); }
  if (name === 'create') onCreateCb();
  syncLayout();
}

export function init() {
  syncLayout();
  $('btn-library').addEventListener('click', openDrawer);
  $('btn-close-library').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  $('search-input').addEventListener('input', applyFilter);
  for (const tab of ['library', 'discover', 'create']) $(`tab-${tab}`).onclick = () => activateTab(tab);
  $('btn-change-folder').onclick = action(async () => {
    const destination = await browseFolders(currentFolder);
    await refresh();
    if (destination !== null) showFolder(destination);
  });
  const chooseTunes = () => { const target = currentFolder; showFolder('all'); addingTo = target; selectMode = true; render(); };
  $('btn-empty-add').onclick = chooseTunes;
  $('btn-folder-add-tunes').onclick = chooseTunes;
  $('btn-select').onclick = () => { if (selectMode) finishSelection(); else { selectMode = true; selectedIds.clear(); render(); } };
  $('btn-select-done').onclick = finishSelection;
  $('btn-select-all').onclick = () => { filtered.forEach((song) => selectedIds.add(song.id)); render(); };
  $('btn-export-selected').onclick = () => {
    const songs = allSongs.filter((song) => selectedIds.has(song.id));
    openExport(songs, songs.length === 1 ? songs[0].title : 'Selected tunes', 'Selected tunes');
  };
  $('btn-export-folder').onclick = () => {
    const folder = realFolder();
    const name = folder?.name || (currentFolder === 'unfiled' ? 'Unfiled tunes' : 'My library');
    openExport(songsInFolder(allSongs, folders, currentFolder), name,
      folder ? `${folderLabel(folders, folder.id)} — including subfolders` : name);
  };
  $('btn-move-folder').onclick = action(() => organizeSongs([...selectedIds], 'move'));
  $('btn-to-folder').onclick = action(async () => {
    if (!addingTo) return organizeSongs([...selectedIds], 'add');
    const target = addingTo;
    await fileSongs([...selectedIds], target, 'add');
    await refresh();
    showFolder(target);
    notify('Tunes added to the folder');
  });
  $('btn-remove-from-folder').onclick = action(async () => {
    await fileSongs([...selectedIds], currentFolder, 'remove');
    selectMode = false;
    selectedIds.clear();
    await refresh();
    notify('Removed from this folder. Tunes remain in your library.');
  });
  $('btn-delete-songs').onclick = action(async () => {
    if (!selectedIds.size || !confirm(`Permanently delete ${selectedIds.size} tunes from the library and every folder?`)) return;
    for (const id of selectedIds) await deleteSong(id);
    selectMode = false;
    selectedIds.clear();
    await refresh();
  });
  $('btn-group-toggle').onclick = action(async () => { groupByTitle = !groupByTitle; render(); await setMeta('groupByTitle', groupByTitle); });
  document.querySelector('.drawer-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = ['library', 'discover', 'create'];
    const index = tabs.findIndex((tab) => $(`tab-${tab}`).getAttribute('aria-selected') === 'true');
    const tab = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
    activateTab(tab); $(`tab-${tab}`).focus();
  });
  document.addEventListener('keydown', (event) => {
    if (!$('library-drawer').classList.contains('open') || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
    if (event.key === 'Tab') {
      const items = [...$('library-drawer').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a, summary')].filter((el) => el.tabIndex >= 0 && el.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
  });
}

export function setSelected(id) { selectedId = id; render(); }
