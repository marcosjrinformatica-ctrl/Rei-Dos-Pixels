const assert=require('node:assert/strict');
const path=require('node:path');
let playwright;try{playwright=require('playwright')}catch{playwright=require('C:/Users/marco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const {chromium}=playwright;
let browser,activePage;
(async()=>{
 browser=await chromium.launch({headless:true,channel:'msedge',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();activePage=page;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_'))errors.push(m.text())});
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.goto('file:///'+path.resolve('index.html').replace(/\\/g,'/'),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PixelGames&&Object.keys(PixelGames).length===10&&document.querySelectorAll('.game-preview img').length===10);
 assert.equal(await page.locator('.game-card').count(),10);
 assert.match(await page.locator('#rankingList').innerText(),/Nenhuma partida/);
 assert.equal(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('rei-dos-pixels:v2')||'{"records":{}}').records).length),0);
 await page.screenshot({path:'previews/desktop-3d.png',fullPage:true});
 const scenes=[];
 for(let id=0;id<10;id++){
  if(id===9){await page.locator('[data-game="9"]').click();assert.equal(await page.locator('#infoDialog').evaluate(e=>e.open),true);await page.locator('#infoDialog .close').click();}
  // Engine entry point lets the test inspect the final game's code without awarding fragments.
  await page.evaluate(i=>Arcade3D.open(i),id);const snap=await page.evaluate(()=>Arcade3D.snapshot());
  assert.equal(snap.phase,'intro');assert.equal(snap.webgl,true);assert.ok(snap.objects>10);
  const glStatus=await page.evaluate(()=>Arcade3D.renderer.gl.getError());assert.equal(glStatus,0);
  await page.locator('#viewToggle').click();await page.locator('#viewToggle').click();
  await page.locator('#gameOverlay').evaluate(el=>el.style.visibility='hidden');
  await page.screenshot({path:`previews/game-${id}-3d.png`});
  await page.locator('#gameOverlay').evaluate(el=>el.style.visibility='');
  scenes.push({id,name:await page.locator('#gameTitle').innerText(),objects:snap.objects});
  await page.locator('#restart').click();await page.waitForFunction(()=>Arcade3D.snapshot().phase==='playing',null,{timeout:15000});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(150);await page.keyboard.up('ArrowRight');
  await page.keyboard.press('p');assert.equal(await page.evaluate(()=>Arcade3D.snapshot().phase),'paused');
  const paused=await page.evaluate(()=>Arcade3D.snapshot().duration);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Arcade3D.snapshot().duration),paused);
  await page.locator('#pause').click();assert.equal(await page.evaluate(()=>Arcade3D.snapshot().phase),'playing');
  await page.locator('#gameDialog .close').click();await page.waitForFunction(()=>Arcade3D.snapshot().phase==='closed');
 }
 // Real idle Serpent run loses its three lives; one result should be recorded exactly once.
 await page.locator('[data-game="0"]').click();await page.locator('#restart').click();
 await page.waitForFunction(()=>Arcade3D.snapshot().phase==='playing');
 await page.evaluate(()=>{const idle={x:0,z:0,action:false,actionPressed:false,pressed:()=>false,down:()=>false};for(let i=0;i<2000&&!Arcade3D.current.done;i++)Arcade3D.current.update(.04,idle)});
 await page.waitForFunction(()=>Arcade3D.snapshot().phase==='finished',null,{timeout:10000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('rei-dos-pixels:v2')));assert.equal(saved.records[0].plays,1);assert.equal(saved.records[0].wins,0);assert.equal(saved.coins,10);assert.equal(saved.fragments.length,0);
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('rei-dos-pixels:v2')).records[0].plays),1);
 await page.locator('#gameDialog .close').click();assert.match(await page.locator('#rankingList').innerText(),/Pixel Serpent/);
 // Win through public directional inputs, then verify the actual score and fragment transaction.
 await page.locator('[data-game="0"]').click();await page.locator('#restart').click();await page.waitForFunction(()=>Arcade3D.snapshot().phase==='playing');
 await page.evaluate(()=>{
  const s=Arcade3D.current,idle={x:0,z:0,action:false},dirs=[{x:1,z:0},{x:0,z:1},{x:-1,z:0},{x:0,z:-1}];
  const same=(a,b)=>a.x===b.x&&a.z===b.z,key=p=>p.x+','+p.z;
  for(let i=0;i<180;i++)s.update(1/240,idle);
  for(let turn=0;turn<2500&&!s.done;turn++){
   const d=s.debug(),q=[{...d.body[0],route:[]}],seen=new Set(),blocked=p=>d.obstacles.some(b=>same(b,p))||d.body.slice(1,-1).some(b=>same(b,p));let route;
   for(let n=0;n<q.length;n++){const p=q[n];if(same(p,d.food)){route=p.route;break;}
    for(const v of dirs){if(!p.route.length&&v.x*d.heading.x+v.z*d.heading.z===-1)continue;const next={x:p.x+v.x,z:p.z+v.z};if(next.z===7&&next.x===0)next.x=13;if(next.z===7&&next.x===14)next.x=1;if(next.x<1||next.x>13||next.z<1||next.z>13||blocked(next)||seen.has(key(next)))continue;seen.add(key(next));q.push({...next,route:[...p.route,v]});}}
   if(!route?.length)throw Error('No safe crystal route');const old=key(d.body[0]);for(let i=0;i<100&&key(s.debug().body[0])===old&&!s.done;i++)s.update(1/240,{...idle,...route[0]});
  }
  if(!s.won)throw Error('Actual Serpent victory failed');
 });
 await page.waitForFunction(()=>Arcade3D.snapshot().phase==='finished');
 const victory=await page.evaluate(()=>JSON.parse(localStorage.getItem('rei-dos-pixels:v2')));assert.equal(victory.records[0].plays,2);assert.equal(victory.records[0].wins,1);assert.deepEqual(victory.fragments,[0]);assert.equal(victory.coins,195);assert.ok(victory.records[0].best>0);await page.locator('#gameDialog .close').click();
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('.game-preview img').length===10);assert.match(await page.locator('#rankingList').innerText(),/Pixel Serpent/);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'previews/mobile-3d.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('[data-game="4"]').click();await page.locator('#restart').click();await page.waitForFunction(()=>Arcade3D.snapshot().phase==='playing');
 const btn=await page.locator('[data-dir="left"]').boundingBox();await page.mouse.move(btn.x+btn.width/2,btn.y+btn.height/2);await page.mouse.down();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Arcade3D.snapshot().input.x),-1);await page.mouse.up();await page.waitForFunction(()=>Arcade3D.snapshot().input.x===0);
 await page.keyboard.press('p');await page.screenshot({path:'previews/mobile-game-3d.png'});await page.locator('#gameDialog .close').click();
 assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({passed:'10 scenes, WebGL, controls, pause, closing, actual loss reward, persistence, empty ranking, secret gate, mobile touch and no overflow',scenes},null,2));await browser.close();
})().catch(async e=>{console.error(e);try{if(activePage)console.error(await activePage.evaluate(()=>window.Arcade3D?.snapshot()));await browser?.close()}catch{}process.exit(1)});


