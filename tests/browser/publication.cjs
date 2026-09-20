// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JAZZ4ALL_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const page = await context.newPage();
  const external = [], errors = [];
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(base).origin) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base);
    await page.locator('#empty-state').waitFor();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.locator('#btn-library').click();
    await page.locator('#btn-about').click();
    assert.match(await page.locator('#about-dialog').textContent(), /Copyright © 2026 Alexandre Campo/);
    const notices = page.locator('#about-dialog details');
    for (let index = 0; index < await notices.count(); index++) {
      const notice = notices.nth(index);
      await notice.locator('summary').click();
      await page.waitForFunction(index => document.querySelectorAll('#about-dialog details')[index].dataset.loaded === 'true', index);
      assert.ok((await notice.locator('pre').textContent()).length > 300);
      assert.equal(await notice.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      await notice.locator('summary').click();
    }
    assert.equal(await page.locator('#about-dialog').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#about-dialog').isVisible(), false);
    // Exercise every private symbol used by imported charts with the new font.
    await page.evaluate(async () => {
      const glyphs = [0xe000,0xe001,0xe002,0xe003,0xe004,0xe005,0xe011,0xe012,0xe013,0xe014,0xe017,0xe020,0xe021,0xe022,0xe034,0xe044];
      await document.fonts.load('24px JazzMusic', String.fromCodePoint(...glyphs));
      if (!document.fonts.check('24px JazzMusic')) throw new Error('Music font did not load offline');
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: all nine license/privacy notices open offline, fit 320px, close with Escape; music symbols load offline; no external requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
