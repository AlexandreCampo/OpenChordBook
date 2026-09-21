// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// OpenChordBook — IndexedDB layer. Plain IDB, no wrapper.
// Stores:
//   songs     { id, uri, title, composer, key, style, bpm, tags[], playlistId, folderIds[], dateAdded }
//   playlists { id, name, dateImported, songCount }
//   folders   { id, name, dateCreated }
//   meta      { key, value }   (e.g. last opened song id, persistent storage flag)

import { LIMITS, boundedText, validateChart } from './chart-safety.js';

const DB_NAME = 'openchordbook';
const DB_VERSION = 2;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('songs')) {
        const songs = db.createObjectStore('songs', { keyPath: 'id' });
        songs.createIndex('title', 'title');
        songs.createIndex('composer', 'composer');
        songs.createIndex('playlistId', 'playlistId');
        songs.createIndex('dateAdded', 'dateAdded');
        songs.createIndex('folderIds', 'folderIds', { multiEntry: true });
      } else {
        // v2 upgrade on an existing database: add the folder membership index.
        const songs = req.transaction.objectStore('songs');
        if (!songs.indexNames.contains('folderIds')) {
          songs.createIndex('folderIds', 'folderIds', { multiEntry: true });
        }
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeNames, mode));
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// A successful request is not yet a committed transaction. Only report success
// once all playlist records and folder assignments have committed together.
async function write(storeNames, operation) {
  const transaction = await tx(storeNames, 'readwrite');
  const complete = new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('The change could not be saved.'));
    transaction.onerror = () => {}; // onabort reports the transaction failure
  });
  complete.catch(() => {});
  try {
    const result = await operation(transaction);
    await complete;
    return result;
  } catch (error) {
    try { transaction.abort(); } catch { /* Already finished. */ }
    await complete.catch(() => {});
    throw error;
  }
}

export async function addSongs(playlist, songs, folderId = null) {
  if (!Array.isArray(songs) || !songs.length || songs.length > LIMITS.songs) throw new Error('Invalid playlist size (1–2000 tunes).');
  if (playlist?.name != null) boundedText(playlist.name, 'Playlist name');
  songs.forEach(validateChart);
  return write(['playlists', 'songs', 'folders'], async (t) => {
    if (folderId && !await promisify(t.objectStore('folders').get(folderId))) {
      throw new Error('That folder no longer exists. Choose another destination.');
    }
    const now = Date.now();
    const playlistId = playlist?.name ? uuid() : null;
    if (playlistId) await promisify(t.objectStore('playlists').add({
      id: playlistId, name: playlist.name, dateImported: now, songCount: songs.length,
    }));
    const songIds = [];
    for (const song of songs) {
      const id = uuid();
      songIds.push(id);
      await promisify(t.objectStore('songs').add({
        id, uri: song._uri || null, raw: song,
        ...(song._chartSource ? { chartSource: song._chartSource } : {}),
        title: song.title || 'Untitled', composer: song.composer || '',
        key: song.key || '', style: song.style || '', bpm: song.bpm || null,
        tags: [], folderIds: folderId ? [folderId] : [], playlistId, dateAdded: now,
      }));
    }
    return { playlistId, songIds };
  });
}

export async function getSong(id) {
  const t = await tx(['songs']);
  return promisify(t.objectStore('songs').get(id));
}

// Authored charts update in place. Folder memberships and other library data
// are read in the same transaction so editing cannot undo an organization change.
export async function saveChart(raw, chartSource, { id = null, folderId = null } = {}) {
  validateChart(raw);
  return write(['songs', 'folders'], async (t) => {
    const store = t.objectStore('songs');
    const previous = id ? await promisify(store.get(id)) : null;
    if (id && !previous) throw new Error('This chart no longer exists in the library.');
    if (previous && previous.chartSource?.version !== 1) throw new Error('This chart cannot be edited here.');
    if (!id && folderId && !await promisify(t.objectStore('folders').get(folderId))) {
      throw new Error('That folder no longer exists. Choose another destination.');
    }
    const record = {
      ...(previous || { id: uuid(), uri: null, tags: [], playlistId: null, folderIds: folderId ? [folderId] : [], dateAdded: Date.now() }),
      raw, chartSource, title: raw.title, key: raw.key, composer: raw.composer,
      style: raw.style, bpm: raw.bpm || null, dateModified: Date.now(),
    };
    await promisify(store.put(record));
    return record.id;
  });
}

export async function listSongs() {
  const t = await tx(['songs']);
  const store = t.objectStore('songs');
  const idx = store.index('title');
  return new Promise((resolve, reject) => {
    const out = [];
    const cursorReq = idx.openCursor();
    cursorReq.onsuccess = () => {
      const c = cursorReq.result;
      if (c) {
        // Records written before folders existed lack the field.
        if (!Array.isArray(c.value.folderIds)) c.value.folderIds = [];
        out.push(c.value);
        c.continue();
      } else { resolve(out); }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function listPlaylists() {
  const t = await tx(['playlists']);
  return promisify(t.objectStore('playlists').getAll());
}

// ---------- Folders ----------
// Folders form a tree: parentId is the parent folder's id, or null for a
// root folder. Records written before the hierarchy existed have no
// parentId and are treated as roots.

function validateFolder(folders, name, parentId, id = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Enter a folder name.');
  if (parentId && !folders.some((f) => f.id === parentId)) throw new Error('The parent folder no longer exists.');
  let parent = parentId;
  const seen = new Set(id ? [id] : []);
  while (parent) {
    if (seen.has(parent)) throw new Error('A folder cannot be moved inside itself or one of its subfolders.');
    seen.add(parent);
    parent = folders.find((f) => f.id === parent)?.parentId;
  }
  if (folders.some((f) => f.id !== id && (f.parentId || null) === (parentId || null)
      && f.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    throw new Error('A folder with that name already exists here.');
  }
  return trimmed;
}

export async function createFolder(name, parentId = null) {
  return write(['folders'], async (t) => {
    const store = t.objectStore('folders');
    const folders = await promisify(store.getAll());
    const folder = { id: uuid(), name: validateFolder(folders, name, parentId), parentId: parentId || null, dateCreated: Date.now() };
    await promisify(store.add(folder));
    return folder;
  });
}

export async function updateFolder(id, name, parentId = null) {
  return write(['folders'], async (t) => {
    const store = t.objectStore('folders');
    const folders = await promisify(store.getAll());
    const folder = folders.find((f) => f.id === id);
    if (!folder) throw new Error('This folder no longer exists.');
    folder.name = validateFolder(folders, name, parentId, id);
    folder.parentId = parentId || null;
    await promisify(store.put(folder));
    return folder;
  });
}

export async function listFolders() {
  const t = await tx(['folders']);
  const folders = await promisify(t.objectStore('folders').getAll());
  return folders
    .map((f) => ({ ...f, parentId: f.parentId || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Delete a folder. Tunes are kept; its subfolders move up to the deleted
 * folder's parent.
 */
export async function deleteFolder(folderId) {
  return write(['folders', 'songs'], async (t) => {
    const folderStore = t.objectStore('folders');
    const doomed = await promisify(folderStore.get(folderId));
    const newParent = (doomed && doomed.parentId) || null;
    await new Promise((resolve, reject) => {
      const cursorReq = folderStore.openCursor();
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (c) {
          if ((c.value.parentId || null) === folderId) {
            c.value.parentId = newParent;
            c.update(c.value);
          }
          c.continue();
        } else { resolve(); }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    await promisify(folderStore.delete(folderId));
    await new Promise((resolve, reject) => {
      const cursorReq = t.objectStore('songs').openCursor();
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (c) {
          if (Array.isArray(c.value.folderIds) && c.value.folderIds.includes(folderId)) {
            c.value.folderIds = c.value.folderIds.filter((x) => x !== folderId);
            c.update(c.value);
          }
          c.continue();
        } else { resolve(); }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  });
}

// Move replaces memberships; add preserves them; remove affects only this
// exact folder. No operation silently removes songs from a descendant folder.
export async function fileSongs(songIds, folderId, mode = 'add') {
  if (!['add', 'move', 'remove'].includes(mode)) throw new Error('Unknown folder action.');
  return write(['songs', 'folders'], async (t) => {
    if (folderId && !await promisify(t.objectStore('folders').get(folderId))) {
      throw new Error('That folder no longer exists.');
    }
    const store = t.objectStore('songs');
    for (const id of new Set(songIds)) {
      const song = await promisify(store.get(id));
      if (!song) continue;
      const memberships = song.folderIds || [];
      if (mode === 'move') song.folderIds = folderId ? [folderId] : [];
      else if (mode === 'add') song.folderIds = folderId ? [...new Set([...memberships, folderId])] : memberships;
      else song.folderIds = memberships.filter((id) => id !== folderId);
      await promisify(store.put(song));
    }
  });
}

export async function addSongsToFolder(folderId, songIds) { return fileSongs(songIds, folderId, 'add'); }
export async function removeSongsFromFolder(folderId, songIds) { return fileSongs(songIds, folderId, 'remove'); }

export async function deleteSong(id) {
  return write(['songs'], (t) => promisify(t.objectStore('songs').delete(id)));
}

export async function wipeAll() {
  const t = await tx(['songs', 'playlists', 'folders'], 'readwrite');
  await promisify(t.objectStore('songs').clear());
  await promisify(t.objectStore('playlists').clear());
  await promisify(t.objectStore('folders').clear());
}

export async function setMeta(key, value) {
  return write(['meta'], (t) => promisify(t.objectStore('meta').put({ key, value })));
}

export async function getMeta(key) {
  const t = await tx(['meta']);
  const row = await promisify(t.objectStore('meta').get(key));
  return row ? row.value : null;
}

export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const already = await navigator.storage.persisted();
    if (already) return true;
    return await navigator.storage.persist();
  }
  return false;
}
