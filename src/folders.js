// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Shared folder editing and destination picking for imports and organization.
import { listFolders, listSongs, createFolder, updateFolder, deleteFolder } from './storage.js';
import { renderFolderTree } from './folder-tree.js';
const $ = (id) => document.getElementById(id);

export function folderPath(folders, id) {
  const path = [], seen = new Set();
  let folder = folders.find((item) => item.id === id);
  while (folder && !seen.has(folder.id)) {
    seen.add(folder.id);
    path.unshift(folder);
    folder = folders.find((item) => item.id === folder.parentId);
  }
  return path;
}

export function folderLabel(folders, id) {
  return id ? folderPath(folders, id).map((folder) => folder.name).join(' / ') : 'Unfiled';
}

function fillOptions(select, folders, selectedId, rootLabel, excludeId = null) {
  select.replaceChildren(new Option(rootLabel, ''));
  const sorted = folders.slice().sort((a, b) => folderLabel(folders, a.id).localeCompare(folderLabel(folders, b.id)));
  for (const folder of sorted) {
    if (excludeId && folderPath(folders, folder.id).some((item) => item.id === excludeId)) continue;
    select.add(new Option(folderLabel(folders, folder.id), folder.id));
  }
  select.value = selectedId || '';
  if (select.selectedIndex < 0) select.selectedIndex = 0;
}

export async function editFolder(id = null, parentId = null) {
  const folders = await listFolders();
  const existing = folders.find((folder) => folder.id === id);
  if (id && !existing) throw new Error('This folder no longer exists.');
  const dialog = $('folder-editor-dialog'), form = $('folder-editor-form');
  $('folder-editor-title').textContent = existing ? 'Edit folder' : 'New folder';
  $('folder-editor-name').value = existing?.name || '';
  $('folder-editor-error').textContent = '';
  $('btn-folder-save').textContent = existing ? 'Save changes' : 'Create folder';
  $('btn-folder-delete').hidden = !existing;
  fillOptions($('folder-editor-parent'), folders, existing?.parentId || parentId, 'Library — top level', id);
  let result = null;
  let busy = false;
  const setBusy = (value) => {
    busy = value;
    form.querySelectorAll('button, input, select').forEach((el) => { el.disabled = value; });
  };
  dialog.oncancel = (event) => { if (busy) event.preventDefault(); };
  form.onsubmit = async (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    if (!form.reportValidity() || busy) return;
    setBusy(true);
    try {
      const parent = $('folder-editor-parent').value || null;
      result = existing
        ? await updateFolder(existing.id, $('folder-editor-name').value, parent)
        : await createFolder($('folder-editor-name').value, parent);
      dialog.close('saved');
    } catch (error) { $('folder-editor-error').textContent = error.message; }
    finally { setBusy(false); }
  };
  $('btn-folder-delete').onclick = async () => {
    if (!existing || busy || !confirm(`Delete the folder “${existing.name}”? Its tunes stay in your library. Subfolders move up one level.`)) return;
    setBusy(true);
    try {
      await deleteFolder(existing.id);
      result = { deleted: true, id: existing.id, parentId: existing.parentId };
      dialog.close('deleted');
    } catch (error) { $('folder-editor-error').textContent = error.message; }
    finally { setBusy(false); }
  };
  const closed = new Promise((resolve) => dialog.addEventListener('close', () => resolve(result), { once: true }));
  dialog.showModal();
  $('folder-editor-name').focus();
  return closed;
}

export async function pickFolder({ title, description, initialId = null, organize = false, mode = 'move', confirmLabel = 'Import tunes', onConfirm }) {
  const dialog = $('destination-dialog');
  if (dialog.open) throw new Error('Finish the current folder choice first.');
  const form = $('destination-form');
  let [folders, songs] = await Promise.all([listFolders(), listSongs()]);
  let location = folders.some((folder) => folder.id === initialId) ? initialId : null;
  let result = null, busy = false;
  $('destination-title').textContent = title;
  $('destination-description').textContent = description;
  $('destination-error').textContent = '';
  $('destination-mode').hidden = !organize;
  form.querySelector(`input[name="folder-mode"][value="${mode}"]`).checked = true;
  const selectedMode = () => organize ? form.elements['folder-mode'].value : 'import';
  const updateMode = () => {
    const choice = selectedMode();
    $('destination-mode-hint').textContent = choice === 'move'
      ? 'Moves the tunes out of their current folders.'
      : choice === 'add' ? 'Keeps the tunes in their current folders too.' : '';
    $('btn-destination-confirm').textContent = choice === 'move' ? 'Move tunes' : choice === 'add' ? 'Add to folder' : confirmLabel;
    $('btn-destination-confirm').disabled = busy || (choice === 'add' && !location);
    $('destination-selection').textContent = location
      ? `Destination: ${folderLabel(folders, location)}`
      : choice === 'add' ? 'Open or create a folder to add these tunes.' : 'Destination: Library only — no folder.';
  };
  function render() {
    const count = renderFolderTree({
      path: $('destination-path'), list: $('destination-list'), folders, songs,
      currentId: location, trail: [{ id: null, name: 'Library' }, ...folderPath(folders, location)],
      onNavigate: (id) => { location = id; render(); },
    });
    $('destination-empty').hidden = !!count;
    $('destination-empty').textContent = location ? 'No subfolders here.' : 'No folders yet. Create one below, or save directly to your library.';
    updateMode();
  }
  form.querySelectorAll('input[name="folder-mode"]').forEach((input) => { input.onchange = updateMode; });
  $('btn-destination-new').onclick = async () => {
    try {
      const created = await editFolder(null, location);
      if (!created) return;
      folders = await listFolders();
      location = created.id;
      render();
    } catch (error) { $('destination-error').textContent = error.message; }
  };
  form.onsubmit = async (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    if (busy || !form.reportValidity() || (selectedMode() === 'add' && !location)) return;
    busy = true;
    form.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
    try {
      const value = await onConfirm({ folderId: location, mode: selectedMode() });
      result = { folderId: location, folderName: folderLabel(folders, location), value };
      dialog.close('saved');
    } catch (error) { $('destination-error').textContent = error.message; }
    finally {
      busy = false;
      form.querySelectorAll('button, input').forEach((el) => { el.disabled = false; });
      updateMode();
    }
  };
  dialog.oncancel = (event) => { if (busy) event.preventDefault(); };
  render();
  const closed = new Promise((resolve) => dialog.addEventListener('close', () => resolve(result), { once: true }));
  dialog.showModal();
  $('destination-path').querySelector('[aria-current]').focus();
  return closed;
}
