// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Shared navigation for opening a folder and choosing a tune destination.
export function renderFolderTree({ path, list, folders, songs, currentId, trail, onNavigate, onEdit }) {
  const navigate = (id) => { onNavigate(id); path.querySelector('[aria-current]')?.focus(); };
  path.replaceChildren();
  for (const item of trail) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'text-btn'; button.textContent = item.name;
    if (item.id === currentId) button.setAttribute('aria-current', 'location');
    button.onclick = () => navigate(item.id);
    if (path.childElementCount) {
      const separator = document.createElement('span');
      separator.textContent = '/'; separator.setAttribute('aria-hidden', 'true'); path.append(separator);
    }
    path.append(button);
  }
  list.replaceChildren();
  const children = folders.filter((item) => item.parentId === currentId).sort((a, b) => a.name.localeCompare(b.name));
  for (const item of children) {
    const row = document.createElement('li'); row.className = 'folder-row';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'folder-open';
    open.dataset.folderId = item.id;
    open.innerHTML = '<svg aria-hidden="true"><use href="#i-folder"/></svg><span><strong></strong><small></small></span><svg aria-hidden="true"><use href="#i-chevron"/></svg>';
    open.querySelector('strong').textContent = item.name;
    const count = songs.filter((song) => song.folderIds?.includes(item.id)).length;
    const subfolders = folders.filter((child) => child.parentId === item.id).length;
    open.querySelector('small').textContent = `${count} tune${count === 1 ? '' : 's'}${subfolders ? ` · ${subfolders} subfolder${subfolders === 1 ? '' : 's'}` : ''}`;
    open.onclick = () => navigate(item.id);
    row.append(open);
    if (onEdit) {
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'icon-btn folder-edit';
      edit.setAttribute('aria-label', `Edit folder ${item.name}`);
      edit.innerHTML = '<svg aria-hidden="true"><use href="#i-more"/></svg>';
      edit.onclick = () => onEdit(item.id);
      row.append(edit);
    }
    list.append(row);
  }
  return children.length;
}
