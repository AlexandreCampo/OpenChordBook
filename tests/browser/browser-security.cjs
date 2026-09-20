const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.JAZZ4ALL_URL || 'http://127.0.0.1:8001';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE});
 try {
  const context = await browser.newContext({viewport:{width:393,height:851}});
  const requests=[];
  await context.route('**/*', async route => {
   if(new URL(route.request().url()).origin!==new URL(base).origin) {requests.push(route.request().url());await route.abort();} else await route.continue();
  });
  const page = await context.newPage();
  await page.goto(base);await page.locator('#empty-state').waitFor({state:'visible'});
  const result=await page.evaluate(async()=>{
   const {parsePlaylist}=await import('/src/import.js');
   const {renderSong}=await import('/src/viewer.js');
   const storage=await import('/src/storage.js');
   const { importFromText } = await import('/src/import.js');
   if((await storage.listSongs()).length)throw new Error('Expected isolated empty storage');
   window.auditExecuted=false;
   const markup='<script>window.auditExecuted++</script><img src><iframe></iframe><a href>probe</a><style>@import url(https://audit.invalid/style)</style>';
   const cases=['[C*'+markup+'* Z','[C<'+markup+'> Z','[C('+ 'G*'+markup+'*'+') Z','[N< C Z','[C*&#60;script&#62;window.auditExecuted++&#60;/script&#62;* Z'];
   const outcomes=[];
   for(const music of cases){
    const uri='irealb://'+encodeURIComponent(`${markup}=${markup}==${markup}=C==${music}==120=3`);
    const html=`<script>window.auditExecuted=true</script><a href="${uri}">Import</a><iframe src="https://audit.invalid/file-frame"></iframe>`;
    const playlist=parsePlaylist(html);
    const div=document.createElement('div');document.body.append(div);
    renderSong({raw:playlist.songs[0]},div);
    outcomes.push({elements:div.querySelectorAll('script,img,iframe,a,svg,object,embed').length,handlers:div.querySelectorAll('[onerror],[onload]').length});
    div.remove();
   }
   const before = await storage.listSongs();
   const good='Good=Tester==Swing=C==[C Z==120=3';
   const bad='Bad=Tester==Swing=C==['+'LZ'.repeat(4096)+'Z==120=3';
   let rejected=false;
   try { await importFromText('irealb://'+encodeURIComponent(good+'==='+bad+'===Mixed malicious playlist')); }
   catch { rejected=true; }
   if(!rejected || (await storage.listSongs()).length!==before.length)throw new Error('Invalid playlist partially imported');
   return {outcomes,executed:window.auditExecuted,songs:(await storage.listSongs()).length};
  });
  assert.ok(result.outcomes.every(x=>x.elements===0&&x.handlers===0));assert.equal(result.executed,false);assert.equal(result.songs,0);assert.deepEqual(requests,[]);
  console.log('PASS: hostile chart markup stays inert, no external requests, invalid multi-tune import writes nothing.', JSON.stringify({htmlInjectionProbes:result.outcomes.length,...result,externalRequests:requests.length}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
