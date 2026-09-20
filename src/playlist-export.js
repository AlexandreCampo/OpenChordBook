// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
import { LIMITS, boundedText, chartForRendering, validateChart } from './chart-safety.js';
import { compileChart, validateMeter } from './chord-entry.js';

const htmlText = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// '=' delimits fields even after percent decoding. The HTML extension below
// retains the exact original text for jazz4all round trips.
const field = (value = '') => String(value).replace(/=/g, '＝');

function encodeMusic(music) {
  // The irealb permutation is its own inverse. Matches the MIT reader's
  // obfusc50/unscramble (Michael Daumling); the final 51 characters stay put.
  let encoded = '';
  for (let offset = 0; offset < music.length; offset += 50) {
    const block = music.slice(offset, offset + 50).split('');
    if (music.length - offset > 51) {
      for (const [first, end] of [[0, 5], [10, 24]]) {
        for (let i = first; i < end; i++) [block[i], block[49 - i]] = [block[49 - i], block[i]];
      }
    }
    encoded += block.join('');
  }
  return `1r34LbKcu7${encoded}`;
}

function portableChart(raw, source) {
  if (!source) return raw;
  if (source.version !== 1 || typeof source.text !== 'string' || source.text.length > 20000
      || typeof source.meter !== 'string') throw new Error('Invalid editable chart data.');
  validateMeter(source.meter);
  const compiled = compileChart(source.text, { meter: source.meter });
  if (compiled.music !== raw.music || JSON.stringify(compiled.chartAnnotations) !== JSON.stringify(raw.chartAnnotations)) {
    throw new Error('The editable chart does not match its chords. Open and save it before exporting.');
  }
  return { ...raw, music: compileChart(source.text, { meter: source.meter, portable: true }).music };
}

function serializeSong(raw) {
  validateChart(raw);
  if (raw.music.includes('=')) throw new Error('Chart text cannot contain an equals sign in iReal Pro format.');
  // Three adjacent '=' characters separate songs. Empty metadata must not
  // accidentally create that separator inside a song's header.
  return [field(raw.title) || ' ', field(raw.composer) || ' ', '', field(raw.style) || ' ', field(raw.key) || ' ', raw.transpose || 0,
    encodeMusic(raw.music), field(raw.exStyle), raw.bpm || 0, raw.repeats || 3].join('=');
}

export function exportFilename(name) {
  return (String(name).normalize('NFC').replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '-').replace(/^[. ]+|[. ]+$/g, '').slice(0, 100) || 'jazz4all') + '.html';
}

export function songsInFolder(songs, folders, folderId) {
  if (folderId === 'all') return songs.slice();
  if (folderId === 'unfiled') return songs.filter((song) => !song.folderIds?.length);
  const included = new Set([folderId]);
  // Traverse once per level; a visited set also tolerates old cyclic records.
  for (let size = -1; size !== included.size;) {
    size = included.size;
    for (const folder of folders) if (included.has(folder.parentId)) included.add(folder.id);
  }
  return songs.filter((song) => song.folderIds?.some((id) => included.has(id)));
}

export function createPlaylistFile(songs, name = 'jazz4all') {
  if (!songs.length || songs.length > LIMITS.songs) throw new Error('Select between 1 and 2000 tunes per file.');
  boundedText(name, 'Playlist name');
  const extensions = [];
  const records = songs.map((song, index) => {
    const raw = chartForRendering(song.raw);
    const portable = portableChart(raw, song.chartSource);
    if (song.chartSource || raw.chartAnnotations?.length || [raw.title, raw.composer, raw.style, raw.key].some((text) => !text)
        || [raw.title, raw.composer, raw.style, raw.key, raw.exStyle].some((text) => text?.includes('='))) {
      extensions.push({ index, raw, ...(song.chartSource ? { chartSource: song.chartSource } : {}) });
    }
    return serializeSong(portable);
  });
  const decoded = records.join('===') + '===' + field(name);
  if (decoded.length > LIMITS.decodedChars) throw new Error('This playlist is too large. Export fewer tunes at a time.');
  const encoded = encodeURIComponent(decoded);
  if (encoded.length + 9 > LIMITS.uriChars) throw new Error('This playlist link is too large. Export fewer tunes at a time.');
  const metadata = extensions.length ? `\n<script type="application/json" id="jazz4all-charts">${JSON.stringify({ version: 1, charts: extensions }).replace(/</g, '\\u003c')}</script>` : '';
  const text = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${htmlText(name)}</title></head>
<body><h1>${htmlText(name)}</h1><p>${songs.length} tune${songs.length === 1 ? '' : 's'}</p>
<p><a href="irealb://${encoded}">Open in iReal Pro</a></p>
<p>To open in jazz4all, choose Discover → Import playlist and select this file.</p>${metadata}
</body></html>\n`;
  if (new TextEncoder().encode(text).length > LIMITS.importBytes) throw new Error('This file is too large. Export fewer tunes at a time.');
  return { text, filename: exportFilename(name), count: songs.length };
}

// Optional, non-executable data keeps authored charts editable, including
// arbitrary meters and section names. Ignore no malformed or stale extensions:
// refusing the import is preferable to silently restoring different chords.
export function restoreExportedCharts(songs, text) {
  const match = /<script type="application\/json" id="jazz4all-charts">([\s\S]*?)<\/script>/i.exec(text);
  if (!match) return;
  const data = JSON.parse(match[1]);
  if (data.version !== 1 || !Array.isArray(data.charts) || data.charts.length > songs.length) throw new Error('Invalid jazz4all chart data.');
  const seen = new Set();
  for (const entry of data.charts) {
    if (!Number.isInteger(entry.index) || !songs[entry.index] || seen.has(entry.index)) throw new Error('Invalid exported chart position.');
    seen.add(entry.index);
    const raw = chartForRendering(entry.raw);
    if (serializeSong(portableChart(raw, entry.chartSource)) !== serializeSong(songs[entry.index])) throw new Error('The playlist and editable chart data do not match.');
    Object.assign(songs[entry.index], raw);
    if (entry.chartSource) songs[entry.index]._chartSource = { version: 1, text: entry.chartSource.text, meter: entry.chartSource.meter };
  }
}
