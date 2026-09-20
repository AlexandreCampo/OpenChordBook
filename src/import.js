// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Parse first, choose a destination, then save the playlist in one transaction.
import { addSongs } from './storage.js';
import { LIMITS, boundedText, validateChart } from './chart-safety.js';
import { restoreExportedCharts } from './playlist-export.js';

export function parsePlaylist(text, defaultName = 'Imported playlist') {
  let playlist;
  if (typeof text !== 'string' || text.length > LIMITS.importBytes) throw new Error('File too large. Choose a playlist smaller than 10 MB.');
  try { playlist = new Playlist(text); }
  catch (error) { throw new Error(`No valid playlist found. ${error.message}`); }
  if (!playlist.songs?.length) throw new Error('This playlist contains no tunes.');
  if (playlist.songs.length > LIMITS.songs) throw new Error('Playlist has too many tunes (2000 maximum).');
  restoreExportedCharts(playlist.songs, text);
  const parser = new iRealRenderer();
  for (const song of playlist.songs) {
    validateChart(song);
    parser.parse(song); // Reject excessive decoded complexity before any database write.
    song.cells = []; // Rebuilt on display; never store derived parser objects.
  }
  const title = text.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  return {
    name: boundedText(playlist.name || title || defaultName, 'Playlist name'),
    songs: playlist.songs.map((song) => ({ ...song, _uri: song.url || song.uri || null })),
  };
}

export async function readPlaylistFile(file) {
  if (file.size > LIMITS.importBytes) throw new Error('File too large. Choose a playlist smaller than 10 MB.');
  return parsePlaylist(await file.text(), file.name.replace(/\.html?$/i, ''));
}

export function readPlaylistURI(uri) {
  if (typeof uri !== 'string' || uri.length > LIMITS.uriChars) throw new Error('Playlist link too large.');
  const value = uri.trim();
  if (!/^irealb:\/\//.test(value)) throw new Error('Paste an irealb:// playlist link, not the address of the forum page.');
  return parsePlaylist(value, 'Pasted playlist');
}

export function savePlaylist(playlist, folderId) {
  return addSongs({ name: playlist.name }, playlist.songs, folderId);
}

// Public helpers for callers that already chose a destination.
export async function importFromText(text, name, folderId = null) { return savePlaylist(parsePlaylist(text, name), folderId); }
export async function importFromFile(file, folderId = null) { return savePlaylist(await readPlaylistFile(file), folderId); }
export async function importFromURI(uri, folderId = null) { return savePlaylist(readPlaylistURI(uri), folderId); }
