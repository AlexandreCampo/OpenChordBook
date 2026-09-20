// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Translate ordinary chord names into the renderer's notation. The original
// text is stored alongside the chart so editing never depends on a lossy parse.
export function encodeChord(value) {
  const chord = value.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[−–]/g, '-');
  if (chord === '%') return 'x';
  const match = /^([A-Ga-g])([b#]?)(.*?)(?:\/([A-Ga-g][b#]?))?$/.exec(chord);
  if (!match || chord.length > 32) throw new Error(`“${value}” is not a chord name.`);
  const root = match[1].toUpperCase() + match[2];
  const modifiers = match[3]
    .replace(/dim/gi, 'o').replace(/[°º]/g, 'o').replace(/[øØ]/g, 'h')
    .replace(/maj/gi, '^').replace(/[MΔ△]/g, '^')
    .replace(/min/gi, '-').replace(/m/g, '-')
    .replace(/aug/gi, '+').replace(/6\/9/g, '69')
    .replace(/[()]/g, '');
  if (!/^(?:sus|add|alt|[+\-^0-9hob#])*$/.test(modifiers)) {
    throw new Error(`“${value}” is not a chord name. Try Dm7, G7b9 or Cmaj7.`);
  }
  const bass = match[4] ? '/' + match[4][0].toUpperCase() + match[4].slice(1) : '';
  // The renderer supports free-text modifiers between asterisks. Input is
  // restricted above, and the usual viewer sanitizer still runs before render.
  return root + (/add|alt/.test(modifiers) ? `*${modifiers}*` : modifiers) + bass;
}

export function validateMeter(value) {
  if (!value) return '';
  const match = /^([1-9]\d?)\/([1-9]\d?)$/.exec(value);
  if (!match) {
    throw new Error('Use two whole numbers from 1 to 99, such as 3/4 or 11/8.');
  }
  return `${Number(match[1])}/${match[2]}`;
}

export function compileChart(source, { meter = '', portable = false } = {}) {
  if (source.length > 20000) throw new Error('Keep this chart under 20,000 characters.');
  const bars = [];
  let section = null, currentMeter = validateMeter(meter), pendingMeter = false, repeatOpen = false;
  for (const [lineIndex, original] of source.split(/\r?\n/).entries()) {
    let line = original.trim();
    if (!line) continue;
    line = line.replace(/^\|/, '').replace(/\|$/, '').trim();
    for (const [barIndex, entry] of line.split('|').entries()) {
      const location = `Line ${lineIndex + 1}, bar ${barIndex + 1}`;
      let text = entry.trim();
      const repeatStart = text.startsWith(':');
      if (repeatStart) text = text.slice(1).trim();
      const repeatEnd = text.endsWith(':');
      if (repeatEnd) text = text.slice(0, -1).trim();
      while (text.startsWith('[')) {
        const label = /^\[([^\]]+)\]\s*/.exec(text);
        if (!label) throw new Error(`${location}: close the label with ].`);
        const value = label[1].trim();
        if (value.includes('/')) {
          try { currentMeter = validateMeter(value); }
          catch (error) { throw new Error(`${location}: ${error.message}`); }
          pendingMeter = true;
        } else {
          if (section) throw new Error(`${location}: add chords after [${section}].`);
          if (!/^[\p{L}\p{N}][\p{L}\p{N} .,_'()-]{0,23}$/u.test(value)) {
            throw new Error(`${location}: use a section name of up to 24 letters, numbers or spaces.`);
          }
          section = value;
        }
        text = text.slice(label[0].length).trim();
      }
      // Labels and meter changes may occupy a line on their own.
      if (!text && entry.trim().endsWith(']') && !repeatStart && !repeatEnd) continue;
      const chords = text.split(/\s+/).filter(Boolean);
      if (!chords.length) throw new Error(`${location}: enter a chord or % to repeat the previous bar.`);
      if (chords.length > 4) throw new Error(`${location}: use up to four chords per bar. Separate bars with |.`);
      if (chords.includes('%') && (chords.length !== 1 || !bars.length)) {
        throw new Error(`${location}: % repeats a whole bar and needs a bar before it.`);
      }
      if (chords[0] === '%' && bars.at(-1)?.meter !== currentMeter) {
        throw new Error(`${location}: enter the chords when changing meter instead of repeating a bar in a different meter.`);
      }
      if (repeatStart) {
        if (repeatOpen) throw new Error(`${location}: close the earlier repeat with :| first.`);
        repeatOpen = true;
      }
      if (repeatEnd) {
        if (!repeatOpen) throw new Error(`${location}: start the repeat with |:.`);
        repeatOpen = false;
      }
      try { bars.push({ section, meter: currentMeter, repeatStart, repeatEnd, chords: chords.map(encodeChord) }); }
      catch (error) { throw new Error(`${location}: ${error.message}`); }
      section = null; pendingMeter = false;
      if (bars.length > 256) throw new Error('Keep this chart to 256 bars or fewer.');
    }
  }
  if (section) throw new Error(`Add chords after [${section}].`);
  if (pendingMeter) throw new Error('Add chords after the time signature.');
  if (repeatOpen) throw new Error('Close the repeated bars with :|.');
  if (!bars.length) throw new Error('Enter some chords to start your chart.');
  let music = '';
  const chartAnnotations = [];
  bars.forEach((bar, index) => {
    const cells = [' ', ' ', ' ', ' '];
    bar.chords.forEach((chord, i) => { cells[bar.chords.length === 2 ? i * 2 : i] = portable ? chord.replace(/\*([^*]+)\*/g, '$1') : chord; });
    const changedMeter = bar.meter && bar.meter !== bars[index - 1]?.meter;
    let marks = '';
    if (portable) {
      // iReal Pro's published protocol has a fixed set of meter/rehearsal
      // symbols. Other labels remain visible as staff text in that app.
      if (changedMeter) marks += ['4/4', '3/4', '2/4', '5/4', '6/4', '7/4', '2/2', '3/2', '5/8', '6/8', '7/8', '9/8', '12/8'].includes(bar.meter)
        ? `T${bar.meter === '12/8' ? '12' : bar.meter.replace('/', '')}` : `<*50${bar.meter}>`;
      if (bar.section) marks += /^[ABCDV]$/.test(bar.section) ? `*${bar.section}` : `<*74${bar.section}>`;
    }
    music += (bar.section ? 'Y' : '') + marks + (bar.repeatStart ? '{' : '|') + cells.join('');
    if (bar.repeatEnd) music += '}';
    else if (index === bars.length - 1) music += 'Z';
    else if (bars[index + 1].section) music += ']';
    if (bar.section || changedMeter) chartAnnotations.push({ cell: index * 4, section: bar.section, meter: changedMeter ? bar.meter : null });
  });
  return { music, chartAnnotations, barCount: bars.length };
}
