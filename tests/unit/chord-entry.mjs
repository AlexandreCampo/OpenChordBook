import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { compileChart } from '../../src/chord-entry.js';
const { iRealRenderer } = createRequire(import.meta.url)('../../vendor/ireal-renderer.js');
const renderer = new iRealRenderer();
function parse(text) {
  const song = { ...compileChart(text), key: 'C', transpose: 0 };
  renderer.parse(song);
  return song;
}

// Verify actual renderer output, including where chords fall within a bar.
const song = parse('[A]\nDm7 G7 | Cmaj7/E | % | F#dim7\n[B]\nBø7 | E7alt | Am6/9 | Cadd9');
assert.equal(song.barCount, 8);
assert.equal(song.cells.length, 32);
assert.deepEqual(song.cells.map((c, i) => c.chord ? i : null).filter(i => i !== null), [0, 2, 4, 8, 12, 16, 20, 24, 28]);
assert.equal(song.cells[0].chord.modifiers, '-7');
assert.equal(song.cells[4].chord.over.note, 'E');
assert.equal(song.cells[8].chord.note, 'x');
assert.equal(song.cells[12].chord.modifiers, 'o7');
assert.equal(song.cells[16].chord.modifiers, 'h7');
assert.equal(song.cells[20].chord.modifiers, '7alt');
assert.equal(song.cells[24].chord.modifiers, '-69');
assert.equal(song.cells[28].chord.modifiers, 'add9');
assert.equal(song.cells[31].bars, 'Z');
assert.equal(song.chartAnnotations.find((a) => a.cell === 16).section, 'B');
assert.equal(song.cells[16].spacer, 1);
const transposed = renderer.transpose(song, { transpose: 2, minor: 'm' });
assert.equal(transposed.cells[0].chord.note, 'E');
assert.equal(transposed.cells[4].chord.note, 'D');
assert.equal(transposed.cells[4].chord.over.note, 'Gb');
assert.equal(transposed.key, 'D');
assert.equal(parse(' | B♭m7 | E♭7(b9) | A♭Δ7 | ').cells.length, 12);
assert.equal(parse('C D E F\nG A B').cells.length, 8);
for (const text of ['', '%', 'C | | G', 'C | % G', 'C D E F G', '[A]', '[A]\n[B]\nC', 'C | potato', '<img src=x>', 'C*bad*', 'C|'.repeat(257)]) {
  assert.throws(() => compileChart(text), undefined, text);
}
assert.throws(() => compileChart('C'.repeat(20001)), /20,000/);
const mixed = compileChart('[AABA]\n|: C | G7 :|\n[Bridge]\n[3/4] F | G | [7/8] Am | [4/4] C', { meter: '4/4' });
const parsed = { ...mixed, key: 'C', transpose: 0 };
renderer.parse(parsed);
assert.equal(parsed.cells[0].bars, '{');
assert.equal(parsed.cells[7].bars, '}');
assert.deepEqual(mixed.chartAnnotations, [
  { cell: 0, section: 'AABA', meter: '4/4' },
  { cell: 8, section: 'Bridge', meter: '3/4' },
  { cell: 16, section: null, meter: '7/8' },
  { cell: 20, section: null, meter: '4/4' },
]);
for (const meter of ['12/8', '11/16', '33/64', '7/3']) {
  assert.equal(compileChart(`[${meter}] C`).chartAnnotations[0].meter, meter);
}
for (const text of ['|: C | G', 'C :|', '|: C |: G :| :|', '[0/4] C', '[7/0] C', '[100/4] C', '[3.5/4] C', '[3/4]', 'C | [3/4] %', '[<img>] C']) {
  assert.throws(() => compileChart(text, { meter: '4/4' }), undefined, text);
}
console.log('PASS: chords, measure spacing, named sections, mixed meters, repeat barlines, slash-bass transposition and invalid input.');
