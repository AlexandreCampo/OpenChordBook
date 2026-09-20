// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// jazz4all — chord chart rendering wrapper around ireal-renderer.
// iRealRenderer is a global from the script tag in index.html.
//
// Security: the renderer uses innerHTML internally on song-derived strings
// (e.g. comment bodies). We sanitize the song after parsing so attacker-
// controlled playlist content cannot escape the chord-chart context.

import { sanitizeSong } from './sanitize.js';
import { chartForRendering } from './chart-safety.js';

let renderer = null;

// Authored charts can use full section names and meters such as 12/8. Keep
// the vendored iReal parser unchanged for imported charts.
class ChartRenderer extends iRealRenderer {
  annotHtml(annots) {
    const standard = [], extra = [];
    for (const annot of annots) {
      if (annot.startsWith('section:')) extra.push(`<irr-section>${annot.slice(8)}</irr-section>`);
      else if (annot.startsWith('meter:')) {
        const [beats, unit] = annot.slice(6).split('/');
        extra.push(`<irr-measure class="authored-meter">${beats}<br>${unit}</irr-measure>`);
      } else standard.push(annot);
    }
    return super.annotHtml(standard) + extra.join('');
  }
}

function getRenderer() {
  // eslint-disable-next-line no-undef
  if (!renderer) renderer = new ChartRenderer();
  return renderer;
}

export function renderSong(songRecord, container, options = {}) {
  const r = getRenderer();
  // Validate stored data too, and copy only bounded renderer fields.
  const song = chartForRendering(songRecord.raw);
  r.parse(song);
  for (const annotation of song.chartAnnotations || []) {
    const cell = song.cells[annotation.cell];
    if (!cell) continue;
    if (annotation.section) cell.annots.push(`section:${annotation.section}`);
    if (annotation.meter) cell.annots.push(`meter:${annotation.meter}`);
  }
  sanitizeSong(song);
  const transposed = r.transpose(song, {
    transpose: options.transpose || 0,
    minor: options.minor || 'm',
    useH: !!options.useH,
    hilite: !!options.hilite,
  });
  container.innerHTML = '';
  r.render(transposed, container, { hilite: !!options.hilite });
  return transposed;
}
