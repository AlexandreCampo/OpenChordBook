// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
import { compileChart, validateMeter } from './chord-entry.js';
import { renderSong } from './viewer.js';
import { saveChart } from './storage.js';
import { pickFolder } from './folders.js';

const $ = (id) => document.getElementById(id);
const fields = ['title', 'key', 'composer', 'style', 'chords'];
let existing = null, initial = '', currentFolder = null, onSaved = () => {}, busy = false, active = false;

function meterValue(prefix) {
  const top = $(`${prefix}-top`).value, bottom = $(`${prefix}-bottom`).value;
  return top || bottom ? `${top}/${bottom}` : '';
}
function values() {
  return { ...Object.fromEntries(fields.map((name) => [name, $(`editor-${name}`).value])), meter: meterValue('editor-meter') };
}
function changed() { return JSON.stringify(values()) !== initial; }
function rawChart() {
  const value = values();
  const { music, chartAnnotations } = compileChart(value.chords, { meter: value.meter });
  return {
    title: value.title.trim() || 'Untitled', key: value.key,
    composer: value.composer.trim(), style: value.style.trim(), transpose: 0,
    music, chartAnnotations,
  };
}
function sizePreview() {
  const width = $('editor-preview-chords').clientWidth;
  if (width) $('editor-preview-chords').style.fontSize = `${Math.max(9, Math.round((width - 280) * .014 + 9))}pt`;
}
function preview() {
  const value = values();
  $('editor-preview-title').textContent = value.title.trim() || 'Untitled';
  $('editor-preview-meta').textContent = [value.composer.trim(), value.style.trim()].filter(Boolean).join(' · ');
  $('editor-preview-key').textContent = value.key.replace('-', 'm');
  $('editor-error').textContent = '';
  $('editor-chords').removeAttribute('aria-invalid');
  try {
    const result = compileChart(value.chords, { meter: value.meter });
    renderSong({ raw: rawChart() }, $('editor-preview-chords'));
    $('editor-preview-empty').hidden = true;
    $('editor-bar-count').textContent = `${result.barCount} bar${result.barCount === 1 ? '' : 's'}`;
    sizePreview();
    return true;
  } catch (error) {
    $('editor-preview-chords').replaceChildren();
    $('editor-preview-empty').hidden = false;
    $('editor-preview-empty').textContent = value.chords.trim() ? 'Check the chord entry to see your chart.' : 'Your chart will appear here as you write.';
    $('editor-bar-count').textContent = '';
    if (value.chords.trim()) {
      $('editor-error').textContent = error.message;
      $('editor-chords').setAttribute('aria-invalid', 'true');
    }
    return false;
  }
}
function setView(view) {
  $('chart-editor').dataset.view = view;
  document.querySelectorAll('[data-editor-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.editorView === view));
  });
  sizePreview();
}
function closeEditor() {
  if (busy) return;
  if (changed() && !confirm('Discard the changes to this chart?')) return;
  active = false;
  document.dispatchEvent(new Event('editorclose'));
}

export function openEditor({ song = null, folderId = null, afterSave }) {
  if (active && (!song || song.id === existing?.id)) return;
  if (active && changed() && !confirm('Discard the current draft and edit this chart?')) return false;
  if (song && song.chartSource?.version !== 1) throw new Error('This chart was not created in the chord editor.');
  active = true;
  existing = song;
  currentFolder = folderId;
  onSaved = afterSave;
  fields.forEach((name) => { $(`editor-${name}`).value = name === 'chords' ? song?.chartSource.text || '' : song?.[name] || (name === 'key' ? 'C' : ''); });
  const [top = '', bottom = ''] = (song ? song.chartSource.meter || '' : '4/4').split('/');
  $('editor-meter-top').value = top; $('editor-meter-bottom').value = bottom;
  $('editor-bar-meter-top').value = '3'; $('editor-bar-meter-bottom').value = '4';
  $('editor-details').open = !!(song?.composer || song?.style);
  $('editor-help').open = $('editor-structure').open = false;
  $('editor-section-name').value = '';
  $('editor-heading').textContent = song ? 'Edit chart' : 'New chart';
  $('btn-editor-save').textContent = song ? 'Save changes' : 'Save chart';
  initial = JSON.stringify(values());
  setView('write');
  preview();
  sizePreview();
  return true;
}

export function initEditor() {
  const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (const minor of [false, true]) for (const key of keys) {
    $('editor-key').add(new Option(key + (minor ? ' minor' : ' major'), key + (minor ? '-' : '')));
  }
  const editor = $('chart-editor');
  $('btn-editor-close').onclick = closeEditor;
  window.addEventListener('beforeunload', (event) => {
    if (active && changed()) { event.preventDefault(); event.returnValue = ''; }
  });
  $('editor-form').addEventListener('input', preview);
  document.querySelectorAll('[data-editor-view]').forEach((button) => {
    button.onclick = () => setView(button.dataset.editorView);
  });
  document.querySelectorAll('[data-chord-insert]').forEach((button) => {
    // Keep the caret and phone keyboard in the chord field while inserting.
    button.addEventListener('pointerdown', (event) => event.preventDefault());
    button.onclick = () => {
      const field = $('editor-chords');
      field.focus();
      const insert = button.dataset.chordInsert === 'newline' ? '\n' : button.dataset.chordInsert;
      field.setRangeText(insert, field.selectionStart, field.selectionEnd, 'end');
      preview();
    };
  });
  // The textarea retains its selection while these controls take focus.
  const currentBar = () => {
    const field = $('editor-chords'), start = field.selectionStart, end = field.selectionEnd;
    const from = Math.max(field.value.lastIndexOf('|', Math.max(0, start - 1)), field.value.lastIndexOf('\n', Math.max(0, start - 1))) + 1;
    const remainder = field.value.slice(Math.max(start, end - 1));
    const next = remainder.search(/[|\n]/);
    return { field, from, to: next < 0 ? field.value.length : Math.max(start, end - 1) + next };
  };
  function insertAnnotation(value) {
    const { field, from } = currentBar();
    const prefix = /^\s*:\s*/.exec(field.value.slice(from));
    const at = from + (prefix?.[0].length || 0);
    field.setRangeText(`[${value}] `, at, at, 'end');
    field.focus(); preview();
  }
  $('btn-insert-section').onclick = () => insertAnnotation($('editor-section-name').value.trim() || 'A');
  $('btn-insert-meter').onclick = () => {
    try {
      const value = meterValue('editor-bar-meter');
      if (!value) throw new Error('Enter a time signature to insert.');
      insertAnnotation(validateMeter(value));
    } catch (error) { $('editor-error').textContent = error.message; }
  };
  $('btn-repeat-bars').onclick = () => {
    const { field, from, to } = currentBar();
    const value = field.value.slice(from, to).trim();
    if (!value) { $('editor-error').textContent = 'Enter or select the bars to repeat first.'; field.focus(); return; }
    const left = field.value[from - 1] === '|' ? '' : '|';
    const right = field.value[to] === '|' ? '' : '|';
    field.setRangeText(`${left}: ${value} :${right}`, from, to, 'select');
    field.focus(); preview();
  };
  $('editor-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!$('editor-title').value.trim()) {
      setView('write'); $('editor-title').focus();
      $('editor-error').textContent = 'Give your chart a title.';
      return;
    }
    if (!preview()) {
      setView('write'); $('editor-chords').focus();
      if (!$('editor-error').textContent) $('editor-error').textContent = 'Enter some chords to start your chart.';
      return;
    }
    busy = true;
    const controls = [...$('editor-form').querySelectorAll('button, input, textarea, select')];
    controls.forEach((control) => { control.disabled = true; });
    try {
      const raw = rawChart(), source = { version: 1, text: $('editor-chords').value, meter: meterValue('editor-meter') };
      let savedId, folderId = currentFolder;
      if (existing) savedId = await saveChart(raw, source, { id: existing.id });
      else {
        const result = await pickFolder({
          title: 'Save chart', description: raw.title, initialId: currentFolder, confirmLabel: 'Save chart',
          onConfirm: ({ folderId }) => saveChart(raw, source, { folderId }),
        });
        if (!result) return;
        savedId = result.value;
        folderId = result.folderId;
      }
      initial = JSON.stringify(values());
      active = false;
      await onSaved({ id: savedId, folderId, created: !existing });
    } catch (error) { $('editor-error').textContent = error.message; }
    finally { busy = false; controls.forEach((control) => { control.disabled = false; }); }
  });
  editor.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault(); if (!busy) $('editor-form').requestSubmit();
    }
  });
  new ResizeObserver(sizePreview).observe($('editor-preview-chords'));
}
