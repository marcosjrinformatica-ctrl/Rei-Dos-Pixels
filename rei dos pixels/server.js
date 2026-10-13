'use strict';
if(Number(process.versions.node.split('.')[0])<24)throw new Error('O Rei dos Pixels requer Node.js 24 ou superior. No Windows, execute iniciar.ps1 para selecionar a versão compatível.');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Store}=require('./server/store.cjs');
const {hash,token,passwordHash,checkPassword,error,validateAccount}=require('./server/security.cjs');
const ROOT=__dirname;
if(fs.existsSync(path.join(ROOT,'.env')))process.loadEnvFile(path.join(ROOT,'.env'));
function createArcadeServer(options={}){
 const config={port:Number(process.env.PORT||3000),host:process.env.HOST||'127.0.0.1',origin:process.env.PUBLIC_ORIGIN||'http://localhost:3000',database:path.resolve(ROOT,process.env.DATABASE_PATH||'data/rei-dos-pixels.sqlite'),...options};
 config.origin=new URL(config.origin).origin;
 const secure=config.origin.startsWith('https:'),store=new Store(config.database),limits=new Map();
 const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;
 function cookies(req){const result={};for(const p of (req.headers.cookie||'').split(';')){const [name,...parts]=p.trim().split('=');if(name)result[name]=parts.join('=');}return result;}
 function session(req){const value=cookies(req).rdp_session;return value?store.session(hash(value)):null;}
 function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 function newSession(res,user){const value=token(),csrf=token();store.addSession(hash(value),user.id,csrf,Date.now()+7*86400000);res.setHeader('Set-Cookie',cookie('rdp_session',value,7*86400));return csrf;}
 function accountResponse(user,csrf){return {user:store.publicUser(user),csrf,...store.progress(user.id)};}
 function auth(req,bodyRequired=true){const user=session(req);if(!user)throw error(401,'Entre na sua conta para continuar.');if(bodyRequired&&req.headers['x-csrf-token']!==user.csrf)throw error(403,'Sua sessão precisa ser atualizada. Recarregue a página.');return user;}
 function rate(req,key,limit){const name=key+':'+req.socket.remoteAddress,now=Date.now();let value=limits.get(name);if(!value||value.until<now)value={count:0,until:now+600000};if(++value.count>limit)throw error(429,'Muitas tentativas. Aguarde alguns minutos.');limits.set(name,value);if(limits.size>10000)for(const [k,v]of limits)if(v.until<now)limits.delete(k);}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error(415,'Envie dados em formato JSON.');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw error(413,'A solicitação é grande demais.');}let data;try{data=JSON.parse(raw||'{}');}catch{throw error(400,'Dados inválidos.');}if(!data||typeof data!=='object'||Array.isArray(data))throw error(400,'Dados inválidos.');return data;}
 function safeOrigin(req){let allowed=req.headers.origin===config.origin;
   // Permit only equivalent loopback addresses on the configured local port.
   if(!allowed){try{const expected=new URL(config.origin),actual=new URL(req.headers.origin);const local=h=>['localhost','127.0.0.1','[::1]'].includes(h);allowed=local(expected.hostname)&&local(actual.hostname)&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&actual.protocol===expected.protocol&&actual.port===expected.port;}catch{}}
   if(!allowed)throw error(403,'Origem da solicitação não autorizada.');const site=req.headers['sec-fetch-site'];if(site==='cross-site')throw error(403,'Solicitação externa não autorizada.');}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{const url=new URL(req.url,config.origin),route=url.pathname;
   if(req.method==='POST'){safeOrigin(req);rate(req,'write',300);}
   if(route==='/api/config'&&req.method==='GET')return reply(res,200,{accounts:true});
   if(route==='/api/me'&&req.method==='GET'){const user=session(req);return reply(res,200,user?accountResponse(user,user.csrf):{user:null,csrf:null});}
   if(route==='/api/auth/register'&&req.method==='POST'){rate(req,'register',10);const input=validateAccount(await body(req),true);if(store.userByEmail(input.email))throw error(409,'Este e-mail já tem uma conta. Entre para continuar.');const salt=crypto.randomBytes(16).toString('hex'),password=await passwordHash(input.password,salt);const user=store.createUser({email:input.email,name:input.name,hash:password,salt});return reply(res,201,accountResponse(user,newSession(res,user)));}
   if(route==='/api/auth/login'&&req.method==='POST'){rate(req,'login',30);const input=validateAccount(await body(req));const user=store.userByEmail(input.email);if(!await checkPassword(input.password,user))throw error(401,'E-mail ou senha incorretos.');return reply(res,200,accountResponse(user,newSession(res,user)));}
   if(route==='/api/auth/logout'&&req.method==='POST'){auth(req);store.logout(hash(cookies(req).rdp_session));res.setHeader('Set-Cookie',cookie('rdp_session','',0));return reply(res,200,{ok:true});}
   if(route==='/api/profile'&&req.method==='POST'){const user=auth(req),data=await body(req);if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>16)throw error(400,'Use um nome com até 16 caracteres.');return reply(res,200,store.rename(user.id,data.name.trim()));}
   if(route==='/api/runs'&&req.method==='POST'){const user=auth(req),data=await body(req);if(!Number.isInteger(data.gameId)||data.gameId<0||data.gameId>9)throw error(400,'Jogo inválido.');return reply(res,201,{runId:store.startRun(user.id,data.gameId)});}
   if(route==='/api/runs/finish'&&req.method==='POST'){const user=auth(req),data=await body(req);if(typeof data.runId!=='string'||data.runId.length>64||!Number.isInteger(data.score)||data.score<0||data.score>1000000||typeof data.won!=='boolean'||!Number.isInteger(data.duration)||data.duration<0||data.duration>7200)throw error(400,'Resultado inválido.');return reply(res,200,store.finishRun(user.id,data.runId,data));}
   if(route==='/api/shop'&&req.method==='POST'){const user=auth(req),data=await body(req);return reply(res,200,store.purchase(user.id,data.item));}
   if(route==='/api/leaderboard'&&req.method==='GET'){const game=url.searchParams.get('game');const id=game===null||game==='all'?null:Number(game);if(id!==null&&(!Number.isInteger(id)||id<0||id>9))throw error(400,'Jogo inválido.');return reply(res,200,{entries:store.leaderboard(id)});}
   if(route.startsWith('/api/'))throw error(404,'Recurso não encontrado.');
   if(!['GET','HEAD'].includes(req.method))throw error(405,'Método não permitido.');
   let relative;try{relative=decodeURIComponent(route).replace(/^\//,'')||'index.html';}catch{throw error(400,'Endereço inválido.');}
   const allowed=new Set(['index.html','styles.css','app.js','auth.js','ambience.js','engine3d.js','games-maze.js','games-action.js','favicon.svg']);
   if(!allowed.has(relative)&&!/^assets\/[a-zA-Z0-9_-]+\.(png|webp|jpg|woff2)$/.test(relative))throw error(404,'Arquivo não encontrado.');
   const filename=path.join(ROOT,relative);if(!fs.existsSync(filename))throw error(404,'Arquivo não encontrado.');
   const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'}[path.extname(filename)];
   res.writeHead(200,{'Content-Type':type||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')return res.end();fs.createReadStream(filename).pipe(res);
  }catch(err){if(!res.headersSent){const status=err.status||500;if(status===500)console.error('Falha no servidor:',err.code||err.name);reply(res,status,{error:status===500?'O servidor não conseguiu concluir a solicitação.':err.message});}else res.end();}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 const cleanup=setInterval(()=>store.cleanup(),600000);cleanup.unref();server.on('close',()=>{clearInterval(cleanup);store.close();});
 return {server,store,config};
}
if(require.main===module){const {server,config}=createArcadeServer();server.listen(config.port,config.host,()=>console.log('Rei dos Pixels: '+config.origin));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));}
module.exports={createArcadeServer};
