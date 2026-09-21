// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// OpenChordBook — sanitize parsed iRealPro songs before handing to the renderer.
//
// The renderer (vendor/ireal-renderer.js) builds chord-chart HTML by
// concatenating song-derived strings into a template that it assigns via
// el.innerHTML = .... That makes any unsanitized string a potential XSS
// sink — most notably comment bodies (commentHtml line 433) which are
// inserted raw between <irr-comment>...</irr-comment>.
//
// We don't trust the renderer to escape; we sanitize the song object
// in-place to defang every string field that flows into innerHTML.
//
// Strategy: HTML-escape every string in cells[].comments[],
// cells[].annots[], cells[].chord.modifiers, cells[].chord.over.modifiers,
// and the alternate chord recursively. Chord notes are restricted to
// [A-GW] by the renderer's chordRegex but we escape them too — cheap.

function escapeHtml(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeChord(chord) {
  if (!chord || typeof chord !== 'object') return chord;
  if (typeof chord.note === 'string') chord.note = escapeHtml(chord.note);
  if (typeof chord.modifiers === 'string') chord.modifiers = escapeHtml(chord.modifiers);
  if (chord.over) sanitizeChord(chord.over);
  if (chord.alternate) sanitizeChord(chord.alternate);
  return chord;
}

export function sanitizeSong(song) {
  if (!song || !Array.isArray(song.cells)) return song;
  for (const cell of song.cells) {
    if (Array.isArray(cell.comments)) {
      cell.comments = cell.comments.map(escapeHtml);
    }
    if (Array.isArray(cell.annots)) {
      cell.annots = cell.annots.map(escapeHtml);
    }
    if (cell.chord) sanitizeChord(cell.chord);
  }
  return song;
}
