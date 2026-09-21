// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Actual rendered dimensions in an isolated library of synthetic charts.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.OPENCHORDBOOK_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, colorScheme: 'light' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const settle = () => page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const size = () => page.locator('#chart-container').evaluate(e => parseFloat(e.style.fontSize));
  const dimensions = () => page.locator('#viewport').evaluate(e => ({ height: e.clientHeight, content: e.scrollHeight, width: e.clientWidth, contentWidth: e.scrollWidth }));
  const open = async title => {
    await page.locator('#btn-library').click();
    await page.locator('.song-row').filter({ has: page.getByText(title, { exact: true }) }).click();
    await page.waitForFunction(title => document.getElementById('chart-title').textContent === title, title);
    await settle();
  };
  try {
    await page.goto(base); await page.locator('#empty-state').waitFor();
    await page.evaluate(async () => {
      const s = await import('/src/storage.js');
      const { compileChart } = await import('/src/chord-entry.js');
      for (const [title, count] of [['Short study', 8], ['Medium study', 96], ['Long study', 256]]) {
        const text = '[A]\n' + Array(count).fill('C').join(' | ');
        await s.saveChart({ title, key: 'C', composer: 'Practice', style: 'Swing', transpose: 0, ...compileChart(text, { meter: '4/4' }) }, { version: 1, text, meter: '4/4' });
      }
      // An old global zoom must no longer carry over when opening a tune.
      await s.setMeta('zoomOffset', 36);
      await (await import('/src/library.js')).refresh();
    });
    await open('Short study');
    assert.equal(await size(), 18, 'Short charts use the default without being enlarged to fill the page');
    await open('Medium study');
    const fitted = await size();
    assert.ok(fitted < 18 && fitted >= 12, `Medium chart should shrink to fit, got ${fitted}`);
    let view = await dimensions();
    assert.ok(view.content <= view.height + 1, 'Whole chart fits vertically');
    assert.ok(view.contentWidth <= view.width + 1, 'Whole chart fits horizontally');
    await page.locator('#btn-zoom-in').click();
    assert.equal(await size(), fitted + 1);
    await page.locator('#btn-transpose-up').click();
    assert.equal(await size(), fitted + 1, 'Transposing retains a manual size');
    await page.locator('#btn-next').click(); await settle();
    assert.equal(await page.locator('#btn-zoom-reset').textContent(), 'Fit', 'Next chart starts fitted');
    await open('Long study');
    assert.equal(await size(), 12, 'Auto fit respects the minimum');
    view = await dimensions();
    assert.ok(view.content > view.height, 'Oversized charts scroll instead of becoming unreadable');
    const bar = await page.locator('#bottombar').boundingBox();
    await page.locator('#viewport').evaluate(e => { e.scrollTop = e.scrollHeight; });
    const last = await page.locator('#chart-container irr-cell').last().boundingBox();
    assert.ok(last.y + last.height <= bar.y + 1, 'The end of a long chart remains reachable above the controls');
    await open('Medium study');
    await page.setViewportSize({ width: 851, height: 393 }); await settle();
    assert.equal(await size(), 12);
    await page.setViewportSize({ width: 393, height: 851 }); await settle();
    assert.equal(await size(), fitted, 'Portrait refits using available height');
    await page.locator('#btn-zoom-in').click();
    await page.locator('#btn-zoom-reset').click();
    assert.equal(await size(), fitted, 'Fit restores the measured size');
    await open('Short study');
    await page.locator('#btn-chart-tools').click();
    assert.equal(await page.locator('#chart-tools-dialog').evaluate(e => getComputedStyle(e, '::backdrop').backdropFilter), 'none');
    await page.locator('#chart-default-size').fill('20');
    assert.equal(await size(), 20, 'Settings update the visible chart immediately');
    await page.getByRole('button', { name: 'Increase minimum chart size', exact: true }).click();
    assert.equal(await page.locator('#chart-minimum-size').inputValue(), '13');
    await page.locator('#chart-default-size').fill('10');
    assert.equal(await page.locator('#chart-minimum-size').inputValue(), '10');
    await page.locator('#chart-minimum-size').fill('14');
    assert.equal(await page.locator('#chart-default-size').inputValue(), '14');
    await page.locator('#chart-default-size').fill('20');
    await page.locator('#chart-minimum-size').fill('13');
    await page.locator('#chart-default-size').fill('');
    await page.locator('#chart-minimum-size').focus();
    assert.equal(await page.locator('#chart-default-size').inputValue(), '20', 'Incomplete input restores the saved value');
    await page.setViewportSize({ width: 320, height: 640 }); await settle();
    assert.equal(await page.locator('#chart-tools-dialog').evaluate(e => e.scrollWidth <= e.clientWidth), true);
    await page.screenshot({ path: '/tmp/openchordbook-chart-size-settings.png', animations: 'disabled' });
    await page.getByRole('button', { name: 'Back to chart', exact: true }).click();
    await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload();
    await page.locator('#chart-container irr-chord').first().waitFor(); await settle();
    assert.equal(await size(), 20, 'Default size survives offline reload');
    await open('Long study');
    assert.equal(await size(), 13, 'Minimum survives offline reload');
    await open('Short study');
    for (const [width, height] of [[1440, 1000], [768, 1024], [393, 851], [320, 640]]) {
      await page.setViewportSize({ width, height }); await settle();
      assert.equal(await size(), 20, 'Extra screen space does not inflate short charts');
    }
    await page.setViewportSize({ width: 393, height: 851 });
    await open('Medium study');
    await page.screenshot({ path: '/tmp/openchordbook-chart-size-fit.png', animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log('PASS: real height/width fit, default/minimum limits, long-chart scrolling, per-tune reset, live settings, portrait/landscape and offline preferences.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
