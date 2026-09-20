import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parsePlaylist, readPlaylistFile, readPlaylistURI } from '../../src/import.js';
import { chartForRendering, validateChart } from '../../src/chart-safety.js';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../../vendor/ireal-reader-tiny.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../../vendor/ireal-renderer.js', import.meta.url), 'utf8'), context);
globalThis.Playlist = vm.runInContext('Playlist', context);
globalThis.iRealRenderer = vm.runInContext('iRealRenderer', context);
const tune = (music = '[C |G7 Z', title = 'Fixture') => `${title}=Tester==Swing=C==${music}==120=3`;
const uri = (data) => 'irealb://' + encodeURIComponent(data);
let checks = 0;
const rejects = (fn, pattern = /too (large|long|many)|limit|Invalid|No valid/i) => { assert.throws(fn, pattern); checks++; };
rejects(() => parsePlaylist('x'.repeat(10 * 1024 * 1024 + 1)));
rejects(() => readPlaylistURI('irealb://' + 'x'.repeat(6 * 1024 * 1024 + 1)));
rejects(() => parsePlaylist('irealb://' + 'x'.repeat(3 * 1024 * 1024 + 1)));
rejects(() => parsePlaylist(uri(Array(2001).fill(tune()).join('===') + '===Too many')));
for (const payload of [
  tune('[C Z', 'x'.repeat(513)),
  tune() + '===' + 'x'.repeat(513),
  tune('[' + 'C'.repeat(16385)),
  tune('[' + 'LZ'.repeat(4096) + 'Z'),
  tune('[' + 'XyQ'.repeat(2048) + 'Z'),
  tune('[' + '*A'.repeat(8192) + 'Z'),
]) rejects(() => parsePlaylist(uri(payload)));
rejects(() => parsePlaylist('irealb://%E0%A4%A'));
rejects(() => readPlaylistURI('https://untrusted.invalid/'), /Paste an irealb/);
let touched = false;
await assert.rejects(readPlaylistFile({ size: 10 * 1024 * 1024 + 1, text() { touched = true; } }), /File too large/);
assert.equal(touched, false); checks++;
for (const raw of [ { music: 'C'.repeat(16385) }, { music: '[C Z', bpm: Infinity }, { music: '[C Z', chartAnnotations: [{ cell: -1 }] }, { music: '[C Z', chartAnnotations: [{ cell: 2048 }] }, { music: '[C Z', chartAnnotations: [{ cell: 0, meter: '<img>' }] } ]) rejects(() => validateChart(raw));
const raw = { music: '[C Z', cells: new Array(10000), hugeUntrustedField: { nested: 'unused' } };
assert.deepEqual(Object.keys(chartForRendering(raw)).sort(), ['title','composer','style','key','exStyle','music','transpose','bpm','repeats','chartAnnotations'].sort()); checks++;
// Old troublemakers must finish promptly; run this file under an external timeout too.
const start = performance.now();
for (const music of ['[' + 'LZ'.repeat(32000) + 'Z', '[' + '<'.repeat(16000), '[C' + '*x'.repeat(7900) + 'Z', '[C' + '('.repeat(7900) + 'Z']) {
  try { parsePlaylist(uri(tune(music))); } catch { /* Rejection is expected for excessive complexity. */ }
}
assert.ok(performance.now() - start < 2000, 'Adversarial charts must not stall parsing'); checks++;
assert.equal(parsePlaylist(uri(Array(1460).fill(tune()).join('===') + '===Large legitimate book')).songs.length, 1460); checks++;
// Optional source files are downloaded to /tmp only, never committed or packaged.
for (const path of process.argv.slice(2)) {
  const result = parsePlaylist(readFileSync(path, 'utf8'));
  console.log(`Source compatibility: ${result.name}: ${result.songs.length} tunes; longest music ${Math.max(...result.songs.map(s => s.music.length))} chars`);
}
console.log(`PASS: ${checks} import/record limits, malformed input, parser stress and large-playlist checks.`);
