// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Actual app UI in an isolated browser, using only synthetic practice charts.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JAZZ4ALL_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const directory = path.resolve(__dirname, '../fastlane/metadata/android/en-US/images/phoneScreenshots');
  const shot = name => page.screenshot({ path: path.join(directory, name + '.png'), animations: 'disabled' });
  try {
    await page.goto(base);
    await page.locator('#empty-state').waitFor();
    await page.evaluate(async () => {
      const s = await import('/src/storage.js');
      const { compileChart } = await import('/src/chord-entry.js');
      const folder = await s.createFolder('Practice book');
      const child = await s.createFolder('Warm-ups', folder.id);
      const text = '[A]\n|: Dm7 | G7 | Cmaj7 | % :|\nAm7 | D7 | Dm7 G7 | C6\n[B]\nFmaj7 | Fm6 | Em7 | A7\nDm7 | G7 | Cmaj7 | %\n[A]\nDm7 | G7 | Cmaj7 | Am7\nDm7 G7 | Cmaj7 | G7 | C6';
      for (const title of ['Morning changes', 'Minor colours', 'Three-beat study', 'Two chords, one bar', 'Turnaround practice', 'Descending bass', 'A quiet bridge', 'Open voicings']) {
        const raw = { title, composer: 'jazz4all practice studies', key: 'C', style: 'Swing', transpose: 0, ...compileChart(text, { meter: '4/4' }) };
        await s.saveChart(raw, { version: 1, text, meter: '4/4' }, { folderId: folder.id });
      }
      const library = await import('/src/library.js');
      await library.refresh();
      library.showFolder(folder.id);
      library.openDrawer('library');
    });
    await page.locator('.song-row').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot('1-library');
    await page.locator('.song-row').filter({ hasText: 'Morning changes' }).click();
    await page.locator('#chart-container irr-chord').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await shot('2-reader');
    await page.locator('#btn-library').click();
    await page.locator('#btn-change-folder').click();
    await shot('3-folders');
    await page.locator('#folder-browser-dialog [data-close-dialog]').click();
    await page.locator('#tab-create').click();
    await page.locator('#editor-title').fill('A waltz in three');
    await page.locator('#editor-meter-top').fill('3');
    await page.locator('#editor-chords').fill('[A]\n|: Cmaj7 | Am7 | Dm7 | G7 :|\n[Bridge]\n[4/4] Fmaj7 | Fm6 | Cmaj7 | G7');
    await shot('4-create');
    await page.locator('[data-editor-view="preview"]').click();
    await page.locator('#editor-preview-chords irr-chord').first().waitFor();
    await shot('5-preview');
    assert.deepEqual(errors, []);
    console.log('Captured five store screenshots with synthetic charts in an isolated phone viewport.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
