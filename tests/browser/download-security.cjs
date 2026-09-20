// Real browser Fetch behavior, synthetic server responses, no saved tunes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JAZZ4ALL_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
 try {
  const context = await browser.newContext({ viewport: { width: 393, height: 851 } });
  let mode='redirect', hits=0; const forbidden=[];
  await context.route('https://dl.dropboxusercontent.com/**', async route => {
   hits++;
   if(mode==='redirect') await route.fulfill({status:302,headers:{location:'https://audit.invalid/secret','access-control-allow-origin':'*'}});
   else if(mode==='large') await route.fulfill({status:200,contentType:'text/html',headers:{'access-control-allow-origin':'*'},body:'x'.repeat(10*1024*1024+1)});
   else { await new Promise(r=>setTimeout(r,2000)); await route.abort().catch(()=>{}); }
  });
  await context.route('https://audit.invalid/**', route => {forbidden.push(route.request().url()); return route.abort();});
  const page=await context.newPage(); await page.goto(base);
  await page.locator('#btn-discover-empty').click(); await page.locator('.discover-search').fill('Chang');
  const button=page.locator('.discover-item').filter({hasText:'Denis Chang — Fakebook'}).locator('button');
  await button.click(); await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Import failed'));
  assert.equal(hits,1); assert.deepEqual(forbidden,[]); assert.equal(await button.isEnabled(),true);
  mode='large'; await button.click(); await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('larger than 10 MB'));
  assert.equal(hits,2); assert.equal(await button.isEnabled(),true);
  mode='slow'; await button.click(); await page.waitForFunction(()=>!![...document.querySelectorAll('button')].find(b=>b.textContent==='Cancel download'));
  await button.click(); await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('cancelled'));
  assert.equal(await button.isEnabled(),true);
  assert.equal(await page.locator('#destination-dialog').isVisible(),false);
  assert.equal(await page.evaluate(async()=> (await (await import('/src/storage.js')).listSongs()).length),0);
  await button.click(); await page.waitForFunction(()=>document.querySelector('.discover-item button').textContent==='Cancel download');
  await page.locator('#tab-library').click();
  await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('cancelled'));
  assert.equal(await page.locator('#destination-dialog').isVisible(),false);
  await page.locator('#tab-discover').click();
  // Timeout is exercised with a virtual clock while fetch remains pending.
  await page.clock.install();
  await page.evaluate(()=>{const original=window.fetch;window.fetch=(url,options)=>String(url).startsWith('https://dl.dropboxusercontent.com/')?new Promise((resolve,reject)=>{window.timeoutFetchStarted=true;options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});}):original(url,options);});
  await button.click(); await page.waitForFunction(()=>document.querySelector('.discover-item button').textContent==='Cancel download');
  await page.waitForFunction(()=>window.timeoutFetchStarted===true); await page.clock.runFor(31000); await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('timed out'));
  assert.equal(await button.isEnabled(),true);
  console.log('PASS: browser rejects cross-host redirects and oversized responses; cancellation and total timeout restore controls without adding tunes.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
