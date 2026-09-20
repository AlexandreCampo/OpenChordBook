// Uses a fresh browser context and synthetic charts only.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JAZZ4ALL_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  async function download() {
    const promise = page.waitForEvent('download');
    await page.locator('#btn-export-save').click();
    const item = await promise;
    const text = await fs.readFile(await item.path(), 'utf8');
    const data = await page.evaluate(async text => {
      const parsed = (await import('/src/import.js')).parsePlaylist(text);
      return { titles: parsed.songs.map((s) => s.title), source: parsed.songs[0]._chartSource };
    }, text);
    return { text, data, filename: item.suggestedFilename() };
  }
  try {
    await page.goto(base);
    await page.locator('#empty-state').waitFor();
    await page.locator('#btn-library').click();
    assert.equal(await page.locator('#btn-export-folder').isDisabled(), true);
    const fixture = await page.evaluate(async () => {
      const s = await import('/src/storage.js');
      const { compileChart } = await import('/src/chord-entry.js');
      const parent = await s.createFolder('Practice'), child = await s.createFolder('Waltzes', parent.id);
      const source = { version: 1, text: '[AABA] |: Dm7 | G7 :| Cmaj7 | %\n[Bridge] [11/16] F7 | [3/4] Bb', meter: '4/4' };
      const first = await s.saveChart({ title: 'Evening study', key: 'C', composer: '', style: 'Swing', ...compileChart(source.text, source) }, source, { folderId: parent.id });
      const second = await s.saveChart({ title: 'Morning study', key: 'C', composer: '', style: 'Waltz', ...compileChart('C | G7', { meter: '3/4' }) }, { version: 1, text: 'C | G7', meter: '3/4' }, { folderId: child.id });
      await s.fileSongs([first], child.id, 'add'); // Count one tune once, even in two folders.
      await s.addSongs({ name: 'Unfiled' }, [{ title: 'Outside', key: 'C', composer: '', style: '', music: '|C   Z' }]);
      const lib = await import('/src/library.js'); await lib.refresh(); lib.showFolder(parent.id);
      return { first, second, parent: parent.id, source };
    });
    await page.locator('#search-input').fill('No match');
    await page.locator('#btn-export-folder').click();
    assert.match(await page.locator('#export-scope').textContent(), /Practice.*including subfolders/);
    assert.match(await page.locator('#export-count').textContent(), /^2 tunes/);
    const folder = await download();
    assert.equal(folder.filename, 'Practice.html');
    assert.deepEqual(folder.data.titles, ['Evening study', 'Morning study']);
    assert.deepEqual(folder.data.source, fixture.source);
    // Round trip the actual downloaded file through the normal import workflow.
    await page.locator('#tab-discover').click();
    await page.locator('#file-input').setInputFiles({ name: folder.filename, mimeType: 'text/html', buffer: Buffer.from(folder.text) });
    await page.locator('#destination-dialog').waitFor();
    await page.locator('#btn-destination-confirm').click();
    await page.locator('#destination-dialog').waitFor({ state: 'hidden' });
    const imported = await page.evaluate(async () => (await import('/src/storage.js')).listSongs());
    assert.equal(imported.length, 5);
    assert.equal(imported.filter((s) => s.chartSource?.text === fixture.source.text).length, 2);
    // Single chart action exports the saved key, regardless of reader transpose.
    await page.locator('#song-list .song-row').first().click();
    await page.locator('#btn-chart-tools').click();
    await page.locator('#btn-transpose-up').click();
    await page.locator('#btn-export-chart').click();
    const individual = await download();
    assert.equal(individual.data.titles.length, 1);
    await page.keyboard.press('Escape');
    await page.locator('#btn-library').click();
    await page.evaluate(async () => { const lib = await import('/src/library.js'); lib.showFolder('all'); });
    await page.locator('#btn-select').click();
    assert.equal(await page.locator('#btn-export-selected').isDisabled(), true);
    await page.locator('#song-list .song-row').nth(0).click();
    await page.locator('#song-list .song-row').nth(2).click();
    await page.locator('#search-input').fill('Outside'); // Hidden selections still belong to the export.
    await page.locator('#btn-export-selected').click();
    const selected = await download();
    assert.equal(selected.data.titles.length, 2);
    assert.ok(!selected.data.titles.includes('Outside'));
    // Native save cancellation, retry and provider errors preserve the selection.
    await page.evaluate(() => { window.exportCalls = 0; window.jazz4allNative = { savePlaylist: async () => { window.exportCalls++; return 'cancelled'; } }; });
    await page.locator('#btn-export-selected').click();
    await page.locator('#btn-export-save').click();
    await page.waitForFunction(() => window.exportCalls === 1);
    assert.equal(await page.locator('#export-dialog').isVisible(), true);
    await page.evaluate(() => { window.jazz4allNative.savePlaylist = async () => { throw new Error('Disk full'); }; });
    await page.locator('#btn-export-save').click();
    await page.getByText('Disk full', { exact: true }).waitFor();
    await page.evaluate(() => { window.jazz4allNative.savePlaylist = async () => 'saved'; });
    await page.locator('#btn-export-save').click();
    await page.locator('#export-dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('#select-count').textContent(), /2 selected/);
    assert.equal((await page.evaluate(async () => (await import('/src/storage.js')).listSongs())).length, 5);
    // Both layouts fit; export remains available after an offline reload.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true); await page.reload();
    await page.locator('#btn-library').click();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 851 });
      await page.locator('#btn-export-folder').click();
      assert.equal(await page.locator('#export-dialog').evaluate((e) => e.scrollWidth <= e.clientWidth), true);
      await page.locator('#btn-export-cancel').click();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: folder/subfolder, selection and chart downloads; file re-import/editing; native cancellation/error/retry; mobile/desktop and offline export.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
