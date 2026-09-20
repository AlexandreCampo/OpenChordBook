// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Android injects this transport only into the exact bundled HTTPS origin.
// Downloads are asynchronous; a source ID is the only network capability.
const host = window.jazz4allHost;
if (host) {
  const pending = new Map();
  let sequence = 0;
  const send = (message) => host.postMessage(JSON.stringify(message));
  host.onmessage = ({ data }) => {
    let message;
    try { message = JSON.parse(data); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    request.finish(message.error ? new Error(message.error) : null, message.value);
  };
  window.jazz4allNative = Object.freeze({
    setAppearance: (value) => send({ type: 'appearance', value }),
    setReadingMode: (value) => send({ type: 'reading', value: !!value }),
    savePlaylist(filename, text) {
      if ([...pending.keys()].some((id) => id.startsWith('export_'))) return Promise.reject(new Error('An export is already in progress.'));
      const id = `export_${++sequence}`;
      return new Promise((resolve, reject) => {
        const finish = (error, value) => {
          if (!pending.delete(id)) return;
          if (error) reject(error); else resolve(value);
        };
        // Saving waits for the user in Android's document picker; no timeout.
        const cancel = () => { send({ type: 'cancel', id }); finish(null, 'cancelled'); };
        pending.set(id, { finish, cancel });
        try { send({ type: 'savePlaylist', id, filename, text }); }
        catch { finish(new Error('Could not open the save window. Try again.')); }
      });
    },
    fetchPlaylist(source, signal) {
      if (signal?.aborted) return Promise.reject(new Error('Download cancelled.'));
      if ([...pending.keys()].some((id) => id.startsWith('download_'))) return Promise.reject(new Error('A download is already in progress.'));
      const id = `download_${++sequence}`;
      return new Promise((resolve, reject) => {
        const cancel = () => { send({ type: 'cancel', id }); finish(new Error('Download cancelled.')); };
        const timer = setTimeout(() => {
          send({ type: 'cancel', id });
          finish(new Error('Download timed out. Try again or open the source.'));
        }, 31000);
        const finish = (error, value) => {
          if (!pending.delete(id)) return;
          clearTimeout(timer);
          signal?.removeEventListener('abort', cancel);
          if (error) reject(error); else resolve(value);
        };
        pending.set(id, { finish, cancel });
        signal?.addEventListener('abort', cancel, { once: true });
        try { send({ type: 'download', id, source }); }
        catch { finish(new Error('Native download is unavailable. Restart the app or import a file.')); }
      });
    },
  });
  window.addEventListener('pagehide', () => {
    for (const request of [...pending.values()]) request.cancel();
  });
}
