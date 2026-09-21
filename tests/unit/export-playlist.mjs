import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPlaylistFile, exportFilename, songsInFolder } from '../../src/playlist-export.js';
import { parsePlaylist } from '../../src/import.js';
import { compileChart } from '../../src/chord-entry.js';

globalThis.Playlist = vm.runInNewContext(readFileSync(new URL('../../vendor/ireal-reader-tiny.js', import.meta.url), 'utf8') + '; Playlist');
globalThis.iRealRenderer = vm.runInNewContext(readFileSync(new URL('../../vendor/ireal-renderer.js', import.meta.url), 'utf8') + '; iRealRenderer');
const raw = { title: 'Été & friends', composer: 'A. Composer', style: 'Swing', key: 'Eb', transpose: 0, bpm: 120, repeats: 3, music: '[Eb   |Bb7   Z' };
// Every scramble boundary, with changing characters so a wrong permutation
// cannot pass merely because empty cells happen to be identical.
for (const length of [1, 49, 50, 51, 52, 99, 100, 101, 102, 151, 152, 501]) {
  const music = '|<'+Array.from({ length }, (_, i) => String.fromCharCode(65 + i % 26)).join('')+'>C   Z';
  const file = createPlaylistFile([{ raw: { ...raw, music } }], 'Round trip');
  assert.equal(new Playlist(file.text).songs[0].music, music);
}
const blank = parsePlaylist(createPlaylistFile([{ raw: { ...raw, composer: '', style: '', key: '' } }]).text).songs[0];
assert.equal(blank.composer, ''); assert.equal(blank.style, ''); assert.equal(blank.key, '');
const source = { version: 1, text: '[A]\n|: Dm7 G7 | Cmaj7 :| % | F7\n[Bridge]\n[11/16] E7 | [3/4] Am | [12/8] G7 | %', meter: '4/4' };
const authored = { ...raw, title: 'irealb:// “A = B” </script>', ...compileChart(source.text, source) };
delete authored.barCount;
assert.match(compileChart('Cadd9 | G7alt', { portable: true }).music, /Cadd9.*G7alt/);
const file = createPlaylistFile([{ raw }, { raw: authored, chartSource: source }], 'Practice & études');
assert.equal(file.filename, 'Practice & études.html');
const nativePlaylist = new Playlist(file.text);
assert.equal(nativePlaylist.songs.length, 2);
assert.match(nativePlaylist.songs[1].music, /T44\*A\{/);
assert.match(nativePlaylist.songs[1].music, /<\*5011\/16><\*74Bridge>/);
assert.match(nativePlaylist.songs[1].music, /T34/);
assert.match(nativePlaylist.songs[1].music, /T12/);
assert.ok(!file.text.includes('</script>"'));
const playlist = parsePlaylist(file.text);
assert.equal(playlist.name, 'Practice & études');
for (const [index, original] of [raw, authored].entries()) {
  for (const field of ['title', 'composer', 'style', 'key', 'music', 'bpm', 'repeats']) assert.equal(playlist.songs[index][field], original[field]);
}
assert.deepEqual(playlist.songs[1]._chartSource, source);
assert.deepEqual(playlist.songs[1].chartAnnotations, authored.chartAnnotations);
const compatible = parsePlaylist(file.text.replace('id="openchordbook-charts"', 'id="jazz4all-charts"'));
assert.deepEqual(compatible.songs[1]._chartSource, source);
assert.deepEqual(compatible.songs[1].chartAnnotations, authored.chartAnnotations);
assert.throws(() => parsePlaylist(file.text.replace('"index":1', '"index":99')), /position/);
assert.throws(() => parsePlaylist(file.text.replace('"version":1,"charts"', '"version":2,"charts"')), /Invalid OpenChordBook/);
assert.throws(() => parsePlaylist(file.text.replace('"meter":"4/4"', '"meter":"0/4"')), /whole numbers|time signature/);
assert.throws(() => createPlaylistFile([], 'Empty'), /1 and 2000/);
assert.throws(() => createPlaylistFile(Array(2001).fill({ raw })), /1 and 2000/);
assert.throws(() => createPlaylistFile([{ raw: { ...raw, music: 'x'.repeat(16385) } }]), /Chart/);
assert.throws(() => createPlaylistFile([{ raw: authored, chartSource: { ...source, text: 'C' } }]), /does not match/);
assert.equal(exportFilename('../../a/b:c?'), '-..-a-b-c-.html');
assert.equal(exportFilename(' ... '), 'openchordbook.html');
const folders = [{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }, { id: 'other', parentId: null }];
const songs = [{ id: 1, folderIds: ['a', 'b'] }, { id: 2, folderIds: ['c'] }, { id: 3, folderIds: ['other'] }, { id: 4, folderIds: [] }];
assert.deepEqual(songsInFolder(songs, folders, 'a').map((s) => s.id), [1, 2]);
assert.deepEqual(songsInFolder(songs, folders, 'unfiled').map((s) => s.id), [4]);
assert.equal(songsInFolder(songs, folders, 'all').length, 4);
console.log('PASS: playlist encoding boundaries, HTML/Unicode escaping, editable round trips, meters/sections/repeats, size limits and recursive folder scope.');
