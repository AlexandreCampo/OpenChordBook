import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parsePlaylist } from '../../src/import.js';

globalThis.Playlist = vm.runInNewContext(readFileSync(new URL('../../vendor/ireal-reader-tiny.js', import.meta.url), 'utf8') + '; Playlist');
globalThis.iRealRenderer = vm.runInNewContext(readFileSync(new URL('../../vendor/ireal-renderer.js', import.meta.url), 'utf8') + '; iRealRenderer');
const encoded = 'Complete fixture=Test Composer==Swing=C==1r34LbKcu7{C |G7 Z}==120=3';
const draft = 'Unfinished fixture=Test Composer==Swing=Eb==[Eb ==0=0';
const uri = 'irealb://' + encodeURIComponent(`${encoded}===${draft}===Mixed encodings`);
for (const input of [uri, `<html><a href="${uri}">Import playlist</a></html>`]) {
  const playlist = parsePlaylist(input);
  assert.equal(playlist.name, 'Mixed encodings');
  assert.equal(playlist.songs.length, 2);
  assert.equal(playlist.songs[0].music, '{C |G7 Z}');
  assert.equal(playlist.songs[1].music, '[Eb ');
  assert.equal(playlist.songs[1].title, 'Unfinished fixture');
  assert.equal(playlist.songs[1].key, 'Eb');
}
assert.throws(() => parsePlaylist('irealb://' + encodeURIComponent('Invalid fixture=Composer==Swing=C==bad-data==120=3')), /No valid playlist/);
console.log('PASS: HTML and URI imports preserve encoded charts and unencoded drafts; invalid data is rejected.');
