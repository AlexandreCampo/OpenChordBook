// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Limits apply before decoding, parsing, saving and rendering, including old records.
export const LIMITS = Object.freeze({
  importBytes: 10 * 1024 * 1024,
  uriChars: 6 * 1024 * 1024,
  decodedChars: 3 * 1024 * 1024,
  songs: 2000,
  musicChars: 16384,
  metadataChars: 512,
  cells: 2048,
});

export function boundedText(value, label, max = LIMITS.metadataChars) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is missing or too long (limit ${max} characters).`);
  return value;
}

export function validateChart(song) {
  if (!song || typeof song !== 'object') throw new Error('Missing chart data.');
  boundedText(song.music, 'Chart', LIMITS.musicChars);
  for (const field of ['title', 'composer', 'style', 'key', 'exStyle']) {
    if (song[field] != null) boundedText(song[field], field);
  }
  for (const field of ['transpose', 'bpm', 'repeats']) {
    if (song[field] != null && (!Number.isFinite(song[field]) || Math.abs(song[field]) > 10000)) throw new Error(`Invalid chart ${field}.`);
  }
  if (song.chartAnnotations != null) {
    if (!Array.isArray(song.chartAnnotations) || song.chartAnnotations.length > LIMITS.cells) throw new Error('Too many chart annotations.');
    for (const a of song.chartAnnotations) {
      if (!a || !Number.isInteger(a.cell) || a.cell < 0 || a.cell >= LIMITS.cells) throw new Error('Invalid chart annotation position.');
      if (a.section != null) boundedText(a.section, 'Section name', 64);
      if (a.meter != null && (typeof a.meter !== 'string' || !/^[1-9]\d?\/[1-9]\d?$/.test(a.meter))) throw new Error('Invalid time signature.');
    }
  }
  return song;
}

// Do not copy arbitrary stored objects or already-parsed cells into the renderer.
export function chartForRendering(raw) {
  validateChart(raw);
  const song = {};
  for (const field of ['title', 'composer', 'style', 'key', 'exStyle', 'music', 'transpose', 'bpm', 'repeats']) song[field] = raw[field];
  song.chartAnnotations = raw.chartAnnotations?.map(({ cell, section, meter }) => ({ cell, section, meter }));
  return song;
}
