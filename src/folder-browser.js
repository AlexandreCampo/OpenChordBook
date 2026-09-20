// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Browsing folders is separate from the tune list. Changes are applied only
// when a location is opened; folder edits themselves commit immediately.
import { listFolders, listSongs } from './storage.js';
import { folderPath, editFolder } from './folders.js';
import { renderFolderTree } from './folder-tree.js';
const $ = (id) => document.getElementById(id);

export async function browseFolders(initialId = 'all') {
  const dialog = $('folder-browser-dialog');
  let folders = [], songs = [], location = initialId, result = null;
  const action = (fn) => async () => {
    try { $('folder-browser-error').textContent = ''; await fn(); }
    catch (error) { $('folder-browser-error').textContent = error.message; }
  };
  const folder = () => folders.find((item) => item.id === location);
  async function refresh() {
    [folders, songs] = await Promise.all([listFolders(), listSongs()]);
    if (!folder()) location = null;
    render();
  }
  async function manage(id = null) {
    const edited = await editFolder(id, id ? null : folder()?.id || null);
    if (!edited) return;
    location = edited.deleted ? edited.parentId || null : edited.id;
    await refresh();
  }
  function render() {
    const count = renderFolderTree({
      path: $('folder-browser-path'), list: $('folder-browser-list'), folders, songs,
      currentId: location, trail: [{ id: null, name: 'Library' }, ...folderPath(folders, location)],
      onNavigate: (id) => { location = id; render(); }, onEdit: (id) => action(() => manage(id))(),
    });
    $('folder-browser-empty').hidden = !!count;
    $('folder-browser-empty').textContent = folder() ? 'No subfolders here.' : 'Create a folder for a set or a repertoire.';
    $('btn-browser-edit').hidden = !folder();
    const name = folder()?.name || 'Library';
    $('folder-browser-selection').textContent = `Selected: ${name}`;
    $('btn-browser-open').textContent = folder() ? 'Open folder' : 'Open library';
  }
  $('btn-browser-new').onclick = action(() => manage());
  $('btn-browser-edit').onclick = action(() => manage(location));
  $('btn-browser-open').onclick = () => { result = location || 'all'; dialog.close(); };
  $('folder-browser-error').textContent = '';
  await refresh();
  const closed = new Promise((resolve) => dialog.addEventListener('close', () => resolve(result), { once: true }));
  dialog.showModal();
  return closed;
}
