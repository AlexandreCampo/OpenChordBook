// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// OpenChordBook — chord chart rendering wrapper around ireal-renderer.
// iRealRenderer is a global from the script tag in index.html.
//
// Security: the renderer uses innerHTML internally on song-derived strings
// (e.g. comment bodies). We sanitize the song after parsing so attacker-
// controlled playlist content cannot escape the chord-chart context.

import { sanitizeSong } from './sanitize.js';
import { chartForRendering } from './chart-safety.js';

let renderer = null;

function timeSignature(beats, unit, authored = false) {
  // JazzMusic bundles Bravura's engraved time-signature numerals at E030–E039.
  // Compose individual digits so arbitrary meters retain the same proportions.
  const digits = value => String(value).replace(/\d/g, digit => String.fromCharCode(0xE030 + Number(digit)));
  return `<irr-measure${authored ? ' class="authored-meter"' : ''} role="img" aria-label="Time signature ${beats}/${unit}"><span aria-hidden="true">${digits(beats)}</span><span aria-hidden="true">${digits(unit)}</span></irr-measure>`;
}

// Authored charts can use full section names and meters such as 12/8. Keep
// the vendored iReal parser unchanged for imported charts.
class ChartRenderer extends iRealRenderer {
  annotHtml(annots) {
    const standard = [], extra = [];
    for (const annot of annots) {
      if (annot.startsWith('section:')) extra.push(`<irr-section>${annot.slice(8)}</irr-section>`);
      else if (annot.startsWith('meter:')) {
        const [beats, unit] = annot.slice(6).split('/');
        extra.push(timeSignature(beats, unit, true));
      } else if (/^T\d\d$/.test(annot)) {
        // iReal's T12 token denotes 12/8, not 1/2. Share musical numerals and
        // spacing between imported and authored charts.
        const [beats, unit] = annot === 'T12' ? ['12', '8'] : annot.slice(1);
        extra.push(timeSignature(beats, unit));
      } else standard.push(annot);
    }
    return super.annotHtml(standard) + extra.join('');
  }
}

function spaceTimeSignatures(table) {
  if (!table.querySelector('irr-measure')) return;
  const rows = document.createDocumentFragment();
  let row = null, column = 0;
  // Preserve the renderer's sixteen timing cells and explicit line breaks.
  // Each row gets its own intrinsic-width meter slots; a change on one line
  // must not consume chord space on every other line of the tune.
  for (const cell of [...table.children]) {
    if (cell.tagName === 'IRR-SPACER') {
      rows.append(cell);
      row = null;
      continue;
    }
    if (!row || column === 16) {
      row = document.createElement('irr-row');
      rows.append(row);
      column = 0;
    }
    const meters = [...cell.querySelectorAll(':scope > irr-measure')];
    if (meters.length) {
      const slot = document.createElement('irr-meter-slot');
      slot.style.gridColumn = String(column * 2 + 1);
      // Opening bar/repeat, then time signature, then the first chord.
      slot.append(...cell.querySelectorAll(':scope > irr-chord > irr-lbar'), ...meters);
      slot.append(...cell.querySelectorAll(':scope > irr-section'));
      row.append(slot);
    }
    cell.style.gridColumn = String(column * 2 + 2);
    row.append(cell);
    column++;
  }
  table.classList.add('meter-layout');
  table.replaceChildren(rows);
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
  spaceTimeSignatures(container.querySelector('irr-chords'));
  return transposed;
}
