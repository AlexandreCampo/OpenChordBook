// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
import { getMeta, setMeta } from './storage.js';

const $ = id => document.getElementById(id);
const MIN_SIZE = 8, MAX_SIZE = 36;
const sizes = { defaultSize: 18, minimumSize: 12 };
let manualSize = null;
let renderedSize = sizes.defaultSize;
let frame = 0;

function drawSize(size) {
  renderedSize = size;
  $('chart-container').style.fontSize = `${size}pt`;
}

export function applyChartSize({ reset = false } = {}) {
  if (reset) manualSize = null;
  const viewport = $('viewport');
  if ($('chart-sheet').hidden || !$('chart-container').firstElementChild || !viewport.clientHeight) return;
  if (manualSize !== null) {
    drawSize(manualSize);
  } else {
    // Measure the real rendered page: heading, annotations, margins and the
    // space left by the live controls. Short charts never exceed the default.
    const fits = size => {
      drawSize(size);
      return viewport.scrollHeight <= viewport.clientHeight + 1
        && viewport.scrollWidth <= viewport.clientWidth + 1;
    };
    if (!fits(sizes.defaultSize)) {
      let low = sizes.minimumSize * 4, high = sizes.defaultSize * 4;
      if (fits(sizes.minimumSize)) {
        // Quarter-point steps find the largest readable size that fits.
        while (high - low > 1) {
          const middle = Math.floor((low + high) / 2);
          if (fits(middle / 4)) low = middle;
          else high = middle;
        }
      }
      drawSize(low / 4);
    }
  }
  const resetButton = $('btn-zoom-reset');
  resetButton.textContent = manualSize === null ? 'Fit' : String(renderedSize);
  resetButton.title = `${renderedSize} pt · Fit chart (0)`;
  resetButton.setAttribute('aria-pressed', String(manualSize === null));
  $('btn-zoom-out').disabled = renderedSize <= MIN_SIZE;
  $('btn-zoom-in').disabled = renderedSize >= 48;
}

export function adjustChartSize(delta) {
  manualSize = Math.max(MIN_SIZE, Math.min(48, renderedSize + delta));
  applyChartSize();
}

function scheduleFit() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => applyChartSize());
}

function syncSettings() {
  for (const [key, id] of [['defaultSize', 'chart-default-size'], ['minimumSize', 'chart-minimum-size']]) {
    $(id).value = sizes[key];
    document.querySelector(`[data-size-input="${id}"][data-size-step="-1"]`).disabled = sizes[key] <= MIN_SIZE;
    document.querySelector(`[data-size-input="${id}"][data-size-step="1"]`).disabled = sizes[key] >= MAX_SIZE;
  }
}

function changeSetting(input) {
  if (!input.validity.valid || !input.value) return;
  const size = input.valueAsNumber;
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) return;
  if (input.id === 'chart-default-size') {
    sizes.defaultSize = size;
    sizes.minimumSize = Math.min(sizes.minimumSize, size);
  } else {
    sizes.minimumSize = size;
    sizes.defaultSize = Math.max(sizes.defaultSize, size);
  }
  syncSettings();
  applyChartSize({ reset: true });
  setMeta('chartSizes', { ...sizes }).catch(() => {
    document.dispatchEvent(new CustomEvent('app-notice', { detail: 'Could not save chart sizes on this device.' }));
  });
}

export async function initChartSizing() {
  const saved = await getMeta('chartSizes');
  for (const key of Object.keys(sizes)) {
    if (Number.isInteger(saved?.[key]) && saved[key] >= MIN_SIZE && saved[key] <= MAX_SIZE) sizes[key] = saved[key];
  }
  sizes.minimumSize = Math.min(sizes.minimumSize, sizes.defaultSize);
  syncSettings();
  for (const id of ['chart-default-size', 'chart-minimum-size']) {
    const input = $(id);
    input.addEventListener('input', () => changeSetting(input));
    input.addEventListener('change', syncSettings);
    input.addEventListener('blur', syncSettings);
  }
  document.querySelectorAll('[data-size-input]').forEach(button => {
    button.addEventListener('click', () => {
      const input = $(button.dataset.sizeInput);
      const key = input.id === 'chart-default-size' ? 'defaultSize' : 'minimumSize';
      input.value = sizes[key] + Number(button.dataset.sizeStep);
      changeSetting(input);
    });
  });
  $('btn-zoom-in').addEventListener('click', () => adjustChartSize(1));
  $('btn-zoom-out').addEventListener('click', () => adjustChartSize(-1));
  $('btn-zoom-reset').addEventListener('click', () => applyChartSize({ reset: true }));
  // Observe the available space, not the chart whose height we are changing.
  new ResizeObserver(scheduleFit).observe($('viewport'));
  document.fonts.ready.then(scheduleFit);
  document.fonts.addEventListener('loadingdone', scheduleFit);
}
