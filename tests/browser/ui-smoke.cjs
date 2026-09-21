// Fresh, non-persistent browsers with synthetic tunes only. No real profiles.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.OPENCHORDBOOK_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const makeURI = (title) => 'irealb://' + encodeURIComponent(`${title}=Test Composer==Swing=C==1r34LbKcu7{C |A-7 |D-7 |G7 |C |A-7 |D-7 |G7 Z}=Swing=120=3`);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shown = (s) => page.locator(s).first().waitFor({ state: 'visible' });
  const hidden = (s) => page.locator(s).waitFor({ state: 'hidden' });
  const data = () => page.evaluate(async () => { const s = await import('/src/storage.js'); return { songs: await s.listSongs(), folders: await s.listFolders() }; });
  const chooser = async () => { await page.locator('#btn-change-folder').click(); await shown('#folder-browser-dialog'); };
  const applyFolder = async () => { await page.locator('#btn-browser-open').click(); await hidden('#folder-browser-dialog'); await page.waitForTimeout(100); };
  const createFolder = async (name, parent) => {
    await chooser(); await page.locator('#btn-browser-new').click();
    await page.locator('#folder-editor-name').fill(name);
    if (parent !== undefined) await page.locator('#folder-editor-parent').selectOption(parent);
    await page.locator('#btn-folder-save').click(); await hidden('#folder-editor-dialog');
    await page.waitForFunction((name) => document.getElementById('folder-browser-selection').textContent === `Selected: ${name}`, name);
    await applyFolder();
    assert.match(await page.locator('#folder-breadcrumb').textContent(), new RegExp(name));
    return (await data()).folders.find((f) => f.name === name).id;
  };
  const beginLink = async (title) => {
    await page.locator('#tab-discover').click();
    await page.locator('#btn-import-uri').click(); await page.locator('#uri-input').fill(makeURI(title));
    await page.locator('#btn-uri-submit').click(); await shown('#destination-dialog');
  };
  const saveImport = async (count) => {
    await page.locator('#btn-destination-confirm').click(); await hidden('#destination-dialog');
    await page.waitForFunction((n) => document.getElementById('library-total').textContent === String(n), count);
  };
  try {
    await page.goto(base); await shown('#empty-state');
    assert.equal((await data()).songs.length, 0);
    await page.locator('#btn-library').click();
    assert.equal(await page.locator('.drawer-tab').count(), 3);
    assert.equal(await page.locator('#btn-new-chart').count(), 0);
    assert.equal(await page.locator('#folder-breadcrumb').textContent(), 'Library / All tunes');
    assert.equal(await page.locator('#tab-panel-library #btn-import-uri').count(), 0);
    await page.locator('#tab-discover').click();
    await shown('.discover-item');
    const importBefore = await page.locator('.import-actions').boundingBox();
    await page.locator('#discover-content').evaluate((e) => { e.scrollTop = 2000; });
    assert.deepEqual(await page.locator('.import-actions').boundingBox(), importBefore);
    assert.ok(importBefore.y > 700);
    await page.locator('#tab-library').click();
    const book = await createFolder('Gig book');
    const friday = await createFolder('Friday set');
    assert.equal((await data()).folders.find((f) => f.id === friday).parentId, book);
    assert.equal(await page.locator('#folder-breadcrumb').textContent(), 'Library / Gig book / Friday set');
    await beginLink('Fixture One');
    assert.equal(await page.locator('#destination-path [aria-current]').textContent(), 'Friday set');
    await page.locator('#destination-dialog button[value="cancel"]').click();
    await shown('#uri-dialog'); assert.equal((await data()).songs.length, 0);
    await page.locator('#btn-uri-submit').click(); await saveImport(1);
    assert.deepEqual((await data()).songs[0].folderIds, [friday]);
    // File import into the parent: it must not include the child's tune.
    await page.locator('#file-input').setInputFiles({ name: 'fixture.html', mimeType: 'text/html', buffer: Buffer.from(`<a href="${makeURI('Fixture Two')}">Fixture</a>`) });
    await shown('#destination-dialog'); await page.locator('#destination-path').getByRole('button', { name: 'Gig book', exact: true }).click(); await saveImport(2);
    assert.equal(await page.locator('.song-row').count(), 1);
    await chooser();
    assert.equal(await page.locator('[data-folder-scope]').count(), 0);
    assert.equal(await page.locator('#folder-browser-list .folder-open').count(), 1);
    await page.locator(`#folder-browser-list .folder-open[data-folder-id="${friday}"]`).click(); await applyFolder();
    assert.equal(await page.locator('.song-row').count(), 1);
    // Reading stays edge to edge and chart settings stay sharp.
    await page.locator('.song-row').click(); await shown('#chart-container irr-chord');
    const sheet = await page.locator('#chart-sheet').boundingBox(); assert.ok(sheet.x <= 1 && sheet.width >= 391);
    await page.locator('#btn-transpose-up').click(); assert.equal(await page.locator('#chart-key').textContent(), 'Db');
    await page.locator('#btn-zoom-in').click();
    await page.locator('#btn-chart-tools').click();
    assert.equal(await page.locator('#chart-tools-dialog').evaluate((e) => getComputedStyle(e, '::backdrop').backdropFilter), 'none');
    await page.locator('#btn-reader-theme').click();
    await page.getByRole('button', { name: 'Back to chart', exact: true }).click();
    await page.locator('#btn-library').click();
    // Move replaces memberships; add and remove preserve other locations.
    await page.getByRole('button', { name: 'Organize Fixture One', exact: true }).click();
    await page.locator('#destination-path').getByRole('button', { name: 'Library', exact: true }).click();
    await page.locator('#destination-list').getByRole('button', { name: /Gig book/ }).click();
    await page.locator('#destination-list').getByRole('button', { name: /Friday set/ }).click();
    assert.equal(await page.locator('#destination-path [aria-current]').textContent(), 'Friday set');
    await page.locator('#destination-path').getByRole('button', { name: 'Gig book', exact: true }).click();
    await page.screenshot({ path: '/tmp/openchordbook-destination-browser.png' });
    await page.locator('#btn-destination-confirm').click();
    await hidden('#destination-dialog'); await page.waitForFunction(() => document.querySelectorAll('.song-row').length === 2);
    const late = await createFolder('Late set', '');
    await page.locator('#btn-empty-add').click(); await page.locator('#btn-select-all').click(); await page.locator('#btn-to-folder').click();
    await page.waitForFunction(() => document.getElementById('select-bar').hidden);
    for (const song of (await data()).songs) assert.deepEqual(new Set(song.folderIds), new Set([book, late]));
    await page.locator('#btn-select').click(); await page.locator('.song-row').first().click(); await page.locator('#btn-remove-from-folder').click();
    await page.waitForFunction(() => document.querySelectorAll('.song-row').length === 1);
    assert.equal((await data()).songs.length, 2);
    const encore = await createFolder('Encore');
    await chooser();
    await page.locator('#folder-browser-path').getByRole('button', { name: 'Late set', exact: true }).click();
    await page.locator('#btn-browser-edit').click();
    await shown('#folder-editor-dialog');
    const parents = await page.locator('#folder-editor-parent option').evaluateAll((items) => items.map((o) => o.value));
    assert.ok(!parents.includes(late) && !parents.includes(encore));
    await page.locator('#folder-editor-name').fill('Evening set'); await page.locator('#folder-editor-parent').selectOption('');
    await page.locator('#btn-folder-save').click(); await hidden('#folder-editor-dialog');
    await page.waitForFunction(() => document.getElementById('folder-browser-selection').textContent === 'Selected: Evening set');
    await applyFolder();
    const cycleError = await page.evaluate(async ({ late, encore }) => {
      try { await (await import('/src/storage.js')).updateFolder(late, 'Evening set', encore); }
      catch (e) { return e.message; }
    }, { late, encore });
    assert.match(cycleError, /inside itself/);
    // Delete only the synthetic test folder; tunes and children survive.
    await chooser(); await page.locator('#btn-browser-edit').click();
    page.once('dialog', (d) => d.accept()); await page.locator('#btn-folder-delete').click(); await hidden('#folder-editor-dialog');
    await page.waitForFunction(() => document.getElementById('btn-browser-edit').hidden); await applyFolder();
    assert.equal((await data()).songs.length, 2);
    assert.equal((await data()).folders.find((f) => f.id === encore).parentId, null);
    for (const song of (await data()).songs) assert.deepEqual(song.folderIds, [book]);
    await chooser(); await page.locator('#btn-browser-new').click(); await page.locator('#folder-editor-name').fill('Gig book');
    await page.locator('#btn-folder-save').click(); await shown('#folder-editor-error');
    assert.match(await page.locator('#folder-editor-error').textContent(), /already exists/);
    await page.locator('#folder-editor-dialog button[value="cancel"]').click();
    await page.getByRole('button', { name: 'Close folder browser', exact: true }).click();
    await beginLink('Fixture Three'); await page.locator('#btn-destination-new').click();
    await page.locator('#folder-editor-name').fill('New imports'); await page.locator('#btn-folder-save').click(); await hidden('#folder-editor-dialog');
    await saveImport(3);
    await page.reload(); await shown('#chart-container irr-chord');
    await page.locator('#btn-library').click();
    assert.equal(await page.locator('#folder-breadcrumb').textContent(), 'Library / New imports');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload();
    await shown('#chart-container irr-chord'); assert.equal((await data()).songs.length, 3);
    assert.deepEqual(errors, []);
    // A separate context measures density and the fixed path while scrolling.
    const dense = await browser.newContext({ viewport: { width: 393, height: 851 } });
    const dp = await dense.newPage(); await dp.goto(base); await dp.locator('#empty-state').waitFor({ state: 'visible' });
    await dp.evaluate(async () => {
      const storage = await import('/src/storage.js');
      if ((await storage.listSongs()).length) throw new Error('Expected isolated empty library');
      await storage.addSongs(null, Array.from({ length: 40 }, (_, i) => ({ title: `Study ${String(i + 1).padStart(2, '0')}`, composer: 'Test Composer', style: 'Swing', key: 'C', transpose: 0, music: '|C   Z' })));
      await (await import('/src/library.js')).refresh();
    });
    await dp.locator('#btn-library').click();
    await dp.waitForFunction(() => document.getElementById('library-drawer').getBoundingClientRect().x >= 0);
    const pathBefore = await dp.locator('#folder-navigation').boundingBox();
    const row = await dp.locator('.song-row').first().boundingBox(); assert.ok(row.height >= 44 && row.height <= 56, `Tune height ${row.height}`);
    await dp.locator('#library-browser').evaluate((e) => { e.scrollTop = 1800; });
    assert.deepEqual(await dp.locator('#folder-navigation').boundingBox(), pathBefore);
    await dp.screenshot({ path: '/tmp/openchordbook-compact-library.png' });
    for (const width of [320, 393, 768, 1440]) {
      await dp.setViewportSize({ width, height: 851 });
      assert.equal(await dp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await dense.close();
    // Native Discover imports still use the destination picker.
    const native = await browser.newContext({ viewport: { width: 393, height: 851 } });
    await native.addInitScript((uri) => { window.playlistRequests = []; window.openchordbookNative = { fetchPlaylist: async (source) => { window.playlistRequests.push(source); return uri; }, setAppearance() {}, setReadingMode(v) { window.lastReadingMode = v; } }; }, makeURI('Discover Fixture'));
    const np = await native.newPage(); await np.goto(base); await np.locator('#empty-state').waitFor({ state: 'visible' });
    await np.locator('#btn-discover-empty').click(); await np.locator('.discover-add-btn').first().click();
    await np.locator('#destination-dialog').waitFor({ state: 'visible' }); await np.locator('#btn-destination-confirm').click();
    await np.waitForFunction(() => document.getElementById('library-total').textContent === '1');
    await np.locator('.song-row').click(); await np.waitForFunction(() => window.lastReadingMode === true);
    assert.equal(await np.locator('#btn-next').isDisabled(), true);
    await np.locator('#btn-transpose-up').click();
    await np.locator('#btn-zoom-in').click();
    assert.equal(await np.evaluate(() => window.lastReadingMode), true);
    await np.locator('#btn-chart-tools').click(); await np.waitForFunction(() => window.lastReadingMode === false);
    await np.getByRole('button', { name: 'Back to chart', exact: true }).click();
    await np.locator('#btn-library').click(); await np.locator('#tab-discover').click();
    await np.locator('.discover-search').fill('Nolan');
    await np.locator('.discover-add-btn').click(); await np.locator('#destination-dialog').waitFor({ state: 'visible' });
    assert.deepEqual((await np.evaluate(() => window.playlistRequests)).at(-1), 'gypsy-jazz-robin-nolan-style-gypsy-jazz');
    await np.locator('#destination-dialog button[value="cancel"]').click();
    // Distinct playlists on the same source page must not share cached URIs.
    for (const query of ['Worship 85', 'Spanish Worship Charts']) {
      await np.locator('.discover-search').fill(query);
      await np.locator('.discover-add-btn').click(); await np.locator('#destination-dialog').waitFor({ state: 'visible' });
      await np.locator('#destination-dialog button[value="cancel"]').click();
    }
    const requests = await np.evaluate(() => window.playlistRequests.slice(-2));
    assert.deepEqual(requests, ['worship-worship-85', 'worship-spanish-worship-charts']);
    await native.close();
    console.log('PASS: compact rows, fixed folder path, folder chooser/create/edit/delete, hierarchy, membership, file/link/Discover imports, reader, persistence and offline use.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
