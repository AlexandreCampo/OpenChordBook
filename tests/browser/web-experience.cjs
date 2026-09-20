// Isolated desktop browser, synthetic exports and mocked network failures.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JAZZ4ALL_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const exportFile = (title, name) => `<a href="irealb://${encodeURIComponent(`${title}=Test Composer==Swing=C==1r34LbKcu7{C |A-7 |D-7 |G7 Z}=Swing=120=3===${name}`)}">Import</a>`;
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const requests = []; let failEarly = true;
  await context.route('https://dl.dropboxusercontent.com/**', async (route) => {
    requests.push(route.request().url());
    const early = route.request().url().includes('Early');
    const name = early ? 'Denis Chang Early Recordings Book' : 'Denis Chang  Fakebook';
    await route.fulfill({ status: early && failEarly ? 503 : 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: exportFile(early ? 'Early fixture' : 'Main fixture', name) });
  });
  const songs = () => page.evaluate(async () => (await import('/src/storage.js')).listSongs());
  const item = (name) => page.locator('.discover-item').filter({ has: page.getByText(name, { exact: true }) });
  const main = () => item('Denis Chang — Fakebook').getByRole('button', { name: /Add/ });
  const early = () => item('Denis Chang — Early Recordings').getByRole('button', { name: /Add/ });
  const dialog = page.locator('#destination-dialog');
  const cancel = async () => { await page.locator('#destination-dialog button[value="cancel"]').click(); await dialog.waitFor({ state: 'hidden' }); };
  try {
    await page.goto(base); await page.locator('#empty-state').waitFor({ state: 'visible' });
    assert.equal((await songs()).length, 0);
    assert.equal(await page.locator('#library-drawer').getAttribute('aria-hidden'), 'true');
    await page.locator('#btn-library').click();
    assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Library0', 'Discover', 'Create']);
    assert.equal(await page.locator('#workspace').evaluate((e) => e.inert), true);
    await page.locator('#tab-discover').click(); await page.locator('.discover-search').fill('Chang');
    await main().waitFor({ state: 'visible' });
    assert.equal(requests.length, 0, 'Opening Discover must not download chart data');
    const pane = await page.locator('#tab-panel-discover').boundingBox();
    assert.ok(pane.width >= 1000, 'Discover should use the main desktop workspace');
    const footer = await page.locator('.import-actions').boundingBox();
    await page.locator('#discover-content').evaluate((e) => { e.scrollTop = 2000; });
    assert.equal((await page.locator('.import-actions').boundingBox()).y, footer.y);
    await main().click(); await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#destination-description').textContent(), 'Denis Chang  Fakebook');
    await cancel(); assert.equal((await songs()).length, 0);
    await main().click(); await dialog.waitFor({ state: 'visible' });
    assert.equal(requests.length, 1, 'Retry after cancelling uses the downloaded copy');
    await page.locator('#btn-destination-new').click();
    await page.locator('#folder-editor-name').fill('Chang'); await page.locator('#btn-folder-save').click();
    await page.locator('#folder-editor-dialog').waitFor({ state: 'hidden' });
    await page.locator('#btn-destination-confirm').click(); await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.getElementById('library-total').textContent === '1');
    const folder = (await songs())[0].folderIds[0]; assert.ok(folder);
    assert.equal(await page.locator('#folder-breadcrumb').textContent(), 'Library / Chang');
    // Opening a tune dismisses the menu on desktop too; settings never blur it.
    await page.locator('.song-row').click(); await page.locator('#chart-container irr-chord').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('#library-drawer').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('#workspace').evaluate((e) => e.inert), false);
    assert.equal((await page.locator('#workspace').boundingBox()).width, 1440);
    await page.locator('#btn-chart-tools').click();
    assert.equal(await page.locator('#chart-tools-dialog').evaluate((e) => getComputedStyle(e, '::backdrop').backdropFilter), 'none');
    await page.getByRole('button', { name: 'Back to chart', exact: true }).click();
    await page.locator('#btn-library').click(); await page.locator('#tab-create').click();
    await page.locator('#editor-title').fill('Desktop draft'); await page.locator('#editor-chords').fill('Dm7 | G7 | Cmaj7 | %');
    await page.locator('#tab-discover').click(); await page.locator('#tab-create').click();
    assert.equal(await page.locator('#editor-title').inputValue(), 'Desktop draft');
    await page.locator('#tab-discover').click();
    await early().click();
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('503'));
    assert.equal(await early().isEnabled(), true); assert.equal((await songs()).length, 1);
    failEarly = false; await early().click(); await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#destination-description').textContent(), 'Denis Chang Early Recordings Book');
    assert.equal(await page.locator('#destination-path [aria-current]').textContent(), 'Chang');
    await page.locator('#btn-destination-confirm').click(); await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.getElementById('library-total').textContent === '2');
    assert.deepEqual((await songs()).map((s) => s.folderIds), [[folder], [folder]]);
    assert.equal(requests.length, 3);
    await page.locator('#tab-discover').click();
    // Resizing preserves the section and footer, with no horizontal overflow.
    for (const width of [1440, 1024, 768, 393, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.locator('#tab-discover').getAttribute('aria-selected'), 'true');
      assert.ok(await page.locator('#btn-import-uri').isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '/tmp/jazz4all-desktop-discover.png' });
    await page.locator('#tab-create').click();
    page.once('dialog', (d) => d.accept()); await page.locator('#btn-editor-close').click();
    await page.locator('#btn-close-library').click();
    await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload();
    await page.locator('#chart-container irr-chord').first().waitFor({ state: 'visible' });
    assert.equal((await songs()).length, 2);
    assert.deepEqual(errors, []);
    console.log('PASS: no automatic downloads, desktop/mobile navigation, Chang downloads, cancellation, cache, retry, folders, draft retention, full-width reading and offline charts.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
