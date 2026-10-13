const assert=require('node:assert/strict');
const {once}=require('node:events');
const {createArcadeServer}=require('../server.js');
let playwright;try{playwright=require('playwright')}catch{playwright=require('C:/Users/marco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
let browser,app,activePage;
async function openAuth(page,mode='login'){
 await page.locator('header > [data-auth]').click();
 await page.locator(mode==='register'?'#authRegisterTab':'#authLoginTab').click();
}
async function fillAccount(page,email,password,name){
 if(name)await page.locator('#authName').fill(name);
 await page.locator('#authEmail').fill(email);
 await page.locator('#authPassword').fill(password);
 await page.locator('#authSubmit').click();
}
(async()=>{
 app=createArcadeServer({database:':memory:',port:0,origin:'http://localhost:3000'});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');app.config.origin='http://127.0.0.1:'+app.server.address().port;
 browser=await playwright.chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'msedge'}),args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 activePage=page;
 page.setDefaultNavigationTimeout(60000);page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|violates.*directive/.test(m.text()))errors.push(m.text())});
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.goto(app.config.origin,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.Account?.available&&document.querySelectorAll('.game-preview img').length===10);
 assert.equal(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return new Set(ids).size===ids.length}),true,'IDs duplicados na interface');
 assert.equal(await page.locator('#authDialog').count(),1);
 // Recover without reloading after a temporary account-service outage.
 await page.route('**/api/config',route=>route.abort());await page.evaluate(()=>Account.initialize());assert.equal(await page.evaluate(()=>Account.available),false);await page.unroute('**/api/config');await openAuth(page);await page.waitForFunction(()=>Account.available);await page.locator('#authGuest').click();
 const password='teste-do-navegador-123';
 await openAuth(page,'register');await page.waitForTimeout(250);await page.screenshot({path:'previews/cadastro-desktop.png'});
 assert.equal(await page.locator('#authGoogle,#googleLink,#authGoogleNotice').count(),0);assert.equal((await page.request.get(app.config.origin+'/api/auth/google')).status(),404);
 await fillAccount(page,'browser-one@example.com',password,'FIRST');
 await page.waitForFunction(()=>Account.user?.name==='FIRST');
 assert.equal(await page.locator('#authDialog').evaluate(e=>e.open),false);
 assert.equal(await page.locator('#saveAction').isHidden(),true);
 // Fechar enquanto o início HTTP está pendente não reabre nem troca a partida nova.
 let releaseStart,blockedStart;const blocked=new Promise(resolve=>blockedStart=resolve),release=new Promise(resolve=>releaseStart=resolve);let delayFirst=true;
 await page.route('**/api/runs',async route=>{if(delayFirst){delayFirst=false;blockedStart();await release;}await route.continue()});
 await page.locator('[data-game="0"]').click();await page.locator('#restart').click();await blocked;
 await page.locator('#gameDialog .close').click();await page.waitForFunction(()=>Arcade3D.snapshot().phase==='closed');
 await page.locator('[data-game="0"]').click();await page.locator('#restart').click();releaseStart();
 await page.waitForFunction(()=>Arcade3D.snapshot().phase==='playing');await page.unroute('**/api/runs');
 const active=app.store.db.prepare("SELECT COUNT(*) AS n FROM runs WHERE status='active'").get().n;assert.equal(active,1);
 await page.locator('#gameDialog .close').click();
 // A perda real do jogo é enviada pela mesma integração usada pelo jogador.
 let interrupted=false;
 await page.route('**/api/runs/finish',async route=>{interrupted=true;await route.abort('failed')});
 await page.locator('[data-game="0"]').click();await page.locator('#restart').click();
 await page.waitForFunction(()=>Arcade3D.snapshot().phase==='playing');
 await page.evaluate(()=>{const idle={x:0,z:0,action:false,actionPressed:false,pressed:()=>false,down:()=>false};for(let i=0;i<2000&&!Arcade3D.current.done;i++)Arcade3D.current.update(.04,idle)});
 await page.waitForFunction(()=>Arcade3D.snapshot().phase==='finished');
 await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.includes('PENDENTE'));
 assert.equal(interrupted,true);const userId=await page.evaluate(()=>Account.user.id);
 assert.deepEqual(app.store.progress(userId).data.records,{});
 await page.unroute('**/api/runs/finish');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>document.querySelector('#coins').textContent==='10');
 assert.equal(app.store.progress(userId).data.records[0].plays,1);
 assert.equal(app.store.progress(userId).data.records[0].wins,0);
 await page.locator('#gameDialog .close').click();
 await page.locator('nav [data-profile]').click();await page.locator('#name').fill('SAVED');await page.locator('#profileForm .primary').click();
 await page.waitForFunction(()=>Account.user?.name==='SAVED');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Account.user?.name==='SAVED');
 assert.equal(await page.locator('#coins').innerText(),'10');
 assert.match(await page.locator('#rankingList').innerText(),/Pixel Serpent/);
 assert.equal(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('rei-dos-pixels:v2')||'{"records":{}}').records).length),0,'Progresso da conta vazou para visitante');
 await page.locator('nav [data-profile]').click();await page.locator('#logout').click();await page.waitForFunction(()=>!Account.user);
 assert.equal(await page.locator('#coins').innerText(),'0');
 await openAuth(page,'register');await fillAccount(page,'browser-two@example.com',password,'SECOND');await page.waitForFunction(()=>Account.user?.name==='SECOND');
 assert.equal(await page.locator('#coins').innerText(),'0');assert.match(await page.locator('#rankingList').innerText(),/Nenhuma partida/);
 await page.locator('#rankingScope').selectOption('accounts');await page.waitForFunction(()=>document.querySelector('#rankingList').textContent.includes('SAVED'));
 assert.equal(await page.locator('#rankingList').innerText().then(s=>s.includes('@')),false);
 await page.locator('nav [data-profile]').click();await page.locator('#logout').click();await page.waitForFunction(()=>!Account.user);
 await openAuth(page);await fillAccount(page,'browser-one@example.com','senha-incorreta-123');
 await page.waitForFunction(()=>document.querySelector('#authStatus').textContent.includes('incorretos'));
 await fillAccount(page,'browser-one@example.com',password);await page.waitForFunction(()=>Account.user?.name==='SAVED');
 assert.equal(await page.locator('#coins').innerText(),'10');
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/password|secret|token/i.test(k))),false);
 app.store.db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run(userId);
 await page.locator('nav [data-profile]').click();await page.locator('#name').fill('EXPIRED');await page.locator('#profileForm .primary').click();await page.waitForFunction(()=>!Account.user);
 assert.equal(app.store.progress(userId).data.name,'SAVED');await page.locator('#profileDialog .close').click();
 await openAuth(page);await fillAccount(page,'browser-one@example.com',password);await page.waitForFunction(()=>Account.user?.name==='SAVED');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#menu').click();await page.locator('nav .mobile-auth').click();await page.locator('#logout').click();await page.waitForFunction(()=>!Account.user);
 await page.locator('nav .mobile-auth').click();await page.screenshot({path:'previews/login-mobile.png'});
 assert.equal(await page.locator('#authDialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: cadastro/login/logout, partida 3D, fila offline, persistência, duas contas isoladas, ranking real, privacidade e layout mobile.');
})().catch(async e=>{console.error(e);if(activePage)console.error(await activePage.evaluate(()=>({user:Account.user?.name,available:Account.available,status:document.querySelector('#authStatus').textContent,submit:document.querySelector('#authSubmit').textContent,valid:document.querySelector('#authForm').checkValidity()})));process.exitCode=1}).finally(async()=>{await browser?.close();if(app)await new Promise(resolve=>app.server.close(resolve))});
