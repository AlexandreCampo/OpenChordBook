// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
// Check rendered spacing, not screenshots alone. All charts are synthetic.
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
  const authored = '[A]\n|: Dm7 G7 | [3/4] Cmaj7 | [12/8] Fmaj7 | [11/16] Bb7 :|\nC | D | E | F\n[Bridge]\n[4/4] Cmaj7/E | [7/8] Dm7 A7 | [99/64] E7 | [2/2] Am6\n[C]\nC | D | E | F';
  const imported = '[A]\n|: C | [3/4] Dm7 | [12/8] G7 | [4/4] C :|\nC | D | E | F';
  const dense = '[12/8] |: Cmaj7/E Dm7/G E7#9/Bb F#m7b5/A | [11/16] Bbm7/Db Eb7/G Abmaj7/C G7b9/B | [33/64] C7b9 E7#5 Fmaj7/A B7b9 | [12/16] Ebm7/Gb F7/A Bbm7 C7 :|';
  const settle = () => page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const open = async title => {
    await page.locator('#btn-library').click();
    await page.locator('.song-row').filter({ has: page.getByText(title, { exact: true }) }).click();
    await page.waitForFunction(title => document.getElementById('chart-title').textContent === title, title);
    await settle();
  };
  const checkSpacing = async (selector = '#chart-container') => {
    const result = await page.locator(selector).evaluate(container => {
      const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5;
      const meters = [...container.querySelectorAll('irr-measure')];
      const bars = [...container.querySelectorAll('irr-lbar, irr-rbar')];
      const collisions = [];
      for (const meter of meters) {
        const box = meter.getBoundingClientRect();
        for (const bar of bars) if (overlap(box, bar.getBoundingClientRect())) collisions.push('barline');
        for (const section of container.querySelectorAll('irr-section')) if (overlap(box, section.getBoundingClientRect())) collisions.push('section');
        const chord = meter.parentElement.nextElementSibling.querySelector(':scope > irr-chord');
        if (chord && box.right > chord.getBoundingClientRect().left - 1) collisions.push('first chord');
        const digits = [...meter.children].map(e => e.getBoundingClientRect());
        if (Math.abs((digits[0].left + digits[0].right) - (digits[1].left + digits[1].right)) > 1) collisions.push('unaligned digits');
      }
      const rows = [...container.querySelectorAll('irr-row')];
      return { count: meters.length, collisions, widths: rows.map(row => row.getBoundingClientRect().width), labels: meters.map(m => m.getAttribute('aria-label')) };
    });
    assert.ok(result.count > 0);
    assert.deepEqual(result.collisions, [], JSON.stringify(result));
    assert.ok(result.widths.every(width => Math.abs(width - result.widths[0]) < 1), 'Rows keep the same outer width');
    return result;
  };
  try {
    await page.goto(base); await page.locator('#empty-state').waitFor();
    await page.evaluate(async ({ authored, imported, dense }) => {
      const s = await import('/src/storage.js');
      const { compileChart } = await import('/src/chord-entry.js');
      const common = { key: 'C', composer: 'Practice', style: 'Swing', transpose: 0 };
      await s.saveChart({ ...common, title: 'Authored meters', ...compileChart(authored, { meter: '4/4' }) }, { version: 1, text: authored, meter: '4/4' });
      const { music } = compileChart(imported, { meter: '4/4', portable: true });
      await s.saveChart({ ...common, title: 'Imported meters', music }, null);
      await s.saveChart({ ...common, title: 'Dense meters', ...compileChart(dense, { meter: '4/4' }) }, { version: 1, text: dense, meter: '4/4' });
      await (await import('/src/library.js')).refresh();
    }, { authored, imported, dense });
    for (const title of ['Authored meters', 'Imported meters']) {
      await open(title);
      for (const [width, height] of [[320, 640], [393, 851], [768, 1024], [1440, 1000], [851, 393]]) {
        await page.setViewportSize({ width, height }); await settle();
        const result = await checkSpacing();
        assert.ok(result.labels.includes('Time signature 12/8'), 'iReal T12 and authored 12/8 render identically');
        const fitted = await page.locator('#chart-container').evaluate(e => parseFloat(e.style.fontSize));
        const overflow = await page.locator('#viewport').evaluate(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1);
        assert.ok(!overflow || fitted === 12, 'Auto-fit includes meter widths before allowing scrolling at the minimum');
        await page.locator('#btn-zoom-in').click(); await checkSpacing();
        await page.locator('#btn-transpose-up').click(); await checkSpacing();
        await page.locator('#btn-zoom-reset').click();
      }
    }
    await page.setViewportSize({ width: 393, height: 851 });
    await open('Dense meters');
    await checkSpacing();
    assert.equal(await page.locator('#chart-container').evaluate(e => parseFloat(e.style.fontSize)), 12);
    assert.ok(await page.locator('#viewport').evaluate(e => e.scrollWidth > e.clientWidth), 'A dense row scrolls at the readable minimum instead of overlapping');
    const chordCollisions = await page.locator('#chart-container').evaluate(container => {
      const chords = [...container.querySelectorAll('irr-cell > irr-chord')].map(e => e.getBoundingClientRect());
      return chords.slice(1).filter((box, index) => box.left < chords[index].right - 1).length;
    });
    assert.equal(chordCollisions, 0, 'Reserved meter space must not make adjacent chords overlap');
    await page.locator('#viewport').evaluate(e => { e.scrollLeft = e.scrollWidth; });
    const ending = await page.locator('#chart-container irr-rbar').last().boundingBox();
    assert.ok(ending.x + ending.width <= 394, 'The right edge remains reachable when a row needs to scroll');
    await open('Dense meters');
    assert.equal(await page.locator('#viewport').evaluate(e => e.scrollLeft), 0, 'Opening a chart returns to its left edge');
    await open('Authored meters');
    await page.screenshot({ path: '/tmp/openchordbook-meter-layout-phone.png', animations: 'disabled' });
    const sectionStarts = await page.locator('#chart-container irr-section').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().left));
    assert.ok(Math.max(...sectionStarts) - Math.min(...sectionStarts) < 1, 'Section labels align with and without a time signature');
    // An extra time-signature slot must only affect the row that contains it.
    const unaffected = await page.locator('#chart-container').evaluate(container => {
      const rows = [...container.querySelectorAll('irr-row')];
      const plain = rows.find(row => !row.querySelector('irr-measure'));
      const cells = [...plain.querySelectorAll('irr-cell')];
      return cells.map(cell => cell.getBoundingClientRect().width);
    });
    assert.ok(Math.max(...unaffected) - Math.min(...unaffected) < 1, 'Unchanged rows keep evenly spaced beats');
    await page.locator('#btn-library').click(); await page.locator('#tab-create').click();
    await page.locator('#editor-title').fill('Meter preview');
    await page.locator('#editor-chords').fill(authored);
    await page.locator('[data-editor-view="preview"]').click();
    await page.locator('#editor-preview-chords irr-measure').first().waitFor(); await settle();
    await checkSpacing('#editor-preview-chords');
    await page.screenshot({ path: '/tmp/openchordbook-meter-layout-preview.png', animations: 'disabled' });
    await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true);
    page.on('dialog', dialog => dialog.accept());
    await page.reload(); await page.locator('#chart-container irr-measure').first().waitFor(); await settle();
    await checkSpacing();
    assert.deepEqual(errors, []);
    console.log('PASS: imported/authored meters, multi-digit alignment, barline/chord/section clearance, repeats, row widths, auto-fit, rotation, transpose, preview and offline rendering.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
