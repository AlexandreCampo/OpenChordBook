// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
import { createPlaylistFile } from './playlist-export.js';

const $ = (id) => document.getElementById(id);

export function openExport(songs, name, description = '') {
  const dialog = $('export-dialog');
  if (dialog.open) return;
  let file;
  try { file = createPlaylistFile(songs, name); }
  catch (error) {
    document.dispatchEvent(new CustomEvent('app-notice', { detail: error.message }));
    return;
  }
  $('export-scope').textContent = description || name;
  $('export-count').textContent = `${file.count} tune${file.count === 1 ? '' : 's'} · iReal Pro HTML playlist`;
  $('export-filename').textContent = file.filename;
  $('export-error').textContent = '';
  const button = $('btn-export-save');
  button.disabled = false;
  let saving = false;
  dialog.oncancel = (event) => { if (saving) event.preventDefault(); };
  button.onclick = async () => {
    if (saving) return;
    saving = true;
    button.disabled = true;
    $('btn-export-cancel').disabled = true;
    $('export-error').textContent = '';
    try {
      if (window.openchordbookNative?.savePlaylist) {
        const result = await window.openchordbookNative.savePlaylist(file.filename, file.text);
        if (result !== 'saved') return; // The system picker was cancelled.
      } else {
        if (/openchordbook\//.test(navigator.userAgent)) throw new Error('Update Android System WebView to save playlist files.');
        const url = URL.createObjectURL(new Blob([file.text], { type: 'text/html;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = file.filename;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      dialog.close();
      document.dispatchEvent(new CustomEvent('app-notice', { detail: window.openchordbookNative?.savePlaylist ? `Saved ${file.filename}` : `Download started: ${file.filename}` }));
    } catch (error) { $('export-error').textContent = error.message; }
    finally {
      saving = false;
      button.disabled = false;
      $('btn-export-cancel').disabled = false;
    }
  };
  dialog.showModal();
}
