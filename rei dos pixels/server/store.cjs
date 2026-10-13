'use strict';
const {DatabaseSync}=require('node:sqlite');
const {randomUUID}=require('node:crypto');
const {mkdirSync}=require('node:fs');
const {dirname}=require('node:path');
const names=['Pixel Serpent','Ghost Byte','Neon Invaders','Brick Kingdom','Turbo Pixel 99','Bomb Maze','Dungeon Fighter 2000','Pixel Crossing','Cyber Arena','King of Pixels'];
const empty=()=>({version:2,name:'',coins:0,xp:0,time:0,fragments:[],achievements:[],records:{},history:[],owned:[],skin:'#39ff14'});
class Store {
 constructor(filename){if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});this.db=new DatabaseSync(filename);this.db.exec(`
  PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT,password_salt TEXT,google_sub TEXT UNIQUE,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS progress(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,game_id INTEGER NOT NULL,started_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'active',score INTEGER,won INTEGER,duration INTEGER);
  CREATE INDEX IF NOT EXISTS run_user ON runs(user_id,started_at);
  CREATE TABLE IF NOT EXISTS oauth_states(token_hash TEXT PRIMARY KEY,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires_at INTEGER NOT NULL,link_user TEXT);
 `);this.cleanup();}
 cleanup(){const now=Date.now();this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);this.db.prepare('DELETE FROM oauth_states WHERE expires_at<?').run(now);this.db.prepare("DELETE FROM runs WHERE status='active' AND started_at<?").run(now-86400000);}
 transaction(callback){this.db.exec('BEGIN IMMEDIATE');try{const value=callback();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 userByEmail(email){return this.db.prepare('SELECT * FROM users WHERE email=?').get(email);}
 publicUser(user){return user?{id:user.id,email:user.email,name:user.name,password:!!user.password_hash}:null;}
 // A coluna legada permanece para não alterar bancos existentes; o acesso atual usa senha.
 createUser({email,name,hash=null,salt=null}){return this.transaction(()=>{if(this.userByEmail(email))throw Object.assign(new Error('Este e-mail já tem uma conta.'),{status:409});const id=randomUUID();this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(id,email,name,hash,salt,null,new Date().toISOString());const data=empty();data.name=name;this.db.prepare('INSERT INTO progress(user_id,payload) VALUES(?,?)').run(id,JSON.stringify(data));return this.db.prepare('SELECT * FROM users WHERE id=?').get(id);});}
 session(hash){return this.db.prepare('SELECT u.*,s.csrf,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(hash,Date.now());}
 addSession(hash,userId,csrf,expiry){this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash,userId,csrf,expiry);}
 logout(hash){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash);}
 progress(userId){const row=this.db.prepare('SELECT * FROM progress WHERE user_id=?').get(userId);return {data:JSON.parse(row.payload),revision:row.revision};}
 write(userId,data){this.db.prepare('UPDATE progress SET payload=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(data),userId);return this.progress(userId);}
 rename(userId,name){return this.transaction(()=>{const {data}=this.progress(userId);data.name=name;this.db.prepare('UPDATE users SET name=? WHERE id=?').run(name,userId);return this.write(userId,data);});}
 startRun(userId,gameId){return this.transaction(()=>{const {data}=this.progress(userId);if(gameId===9&&data.fragments.length<9)throw Object.assign(new Error('Conquiste os nove fragmentos primeiro.'),{status:403});this.db.prepare("UPDATE runs SET status='abandoned' WHERE user_id=? AND status='active'").run(userId);const id=randomUUID();this.db.prepare('INSERT INTO runs(id,user_id,game_id,started_at) VALUES(?,?,?,?)').run(id,userId,gameId,Date.now());return id;});}
 finishRun(userId,runId,result){return this.transaction(()=>{const run=this.db.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').get(runId,userId);if(!run)throw Object.assign(new Error('Partida não encontrada.'),{status:404});if(run.status==='finished')return {...this.progress(userId),duplicate:true,reward:0};if(run.status!=='active')throw Object.assign(new Error('Essa partida já foi encerrada.'),{status:409});
  const elapsed=Math.ceil((Date.now()-run.started_at)/1000),duration=Math.min(result.duration,elapsed),id=run.game_id,{data}=this.progress(userId),score=result.score,won=result.won;
  if(won&&elapsed<2)throw Object.assign(new Error('Partida concluída cedo demais. Tente novamente.'),{status:400});
  const record=data.records[id]||{best:0,plays:0,wins:0,total:0,time:0,last:''};const newRecord=score>record.best;let reward=10+(newRecord?25:0)+(won?50:0);
  const unlock=x=>{if(!data.achievements.includes(x))data.achievements.push(x);};
  if(won&&id<9&&!data.fragments.includes(id)){data.fragments.push(id);reward+=100;unlock('fragment');}
  record.best=Math.max(record.best,score);record.plays++;record.wins+=won?1:0;record.total+=score;record.time+=duration;record.last=new Date().toISOString();data.records[id]=record;
  data.coins+=reward;data.xp+=20+Math.min(100,Math.floor(score/100))+(won?80:0);data.time+=duration;data.history.push({id,score,won,duration,date:record.last});data.history=data.history.slice(-50);
  unlock('first');if(won&&id===0)unlock('serpent');if(won&&id===1)unlock('ghost');if([...Array(9).keys()].every(i=>data.records[i]?.plays>0))unlock('arcade');if(won&&id===9)unlock('king');
  this.db.prepare("UPDATE runs SET status='finished',score=?,won=?,duration=? WHERE id=?").run(score,won?1:0,duration,runId);return {...this.write(userId,data),reward,duplicate:false};});}
 purchase(userId,item){const colors={green:'#39ff14',cyan:'#00f5ff',pink:'#ff00c8',gold:'#ffd600'};if(!colors[item])throw Object.assign(new Error('Item inválido.'),{status:400});return this.transaction(()=>{const {data}=this.progress(userId);if(item!=='green'&&!data.owned.includes(item)){if(data.coins<100)throw Object.assign(new Error('Você precisa de 100 Pixel Coins.'),{status:400});data.coins-=100;data.owned.push(item);}data.skin=colors[item];return this.write(userId,data);});}
 leaderboard(gameId){const rows=this.db.prepare('SELECT u.id,u.name,p.payload FROM users u JOIN progress p ON p.user_id=u.id').all();return rows.map(row=>{const data=JSON.parse(row.payload),records=gameId===null?Object.values(data.records):[data.records[gameId]].filter(Boolean);return {name:row.name,score:records.reduce((sum,r)=>sum+r.best,0),plays:records.reduce((sum,r)=>sum+r.plays,0)};}).filter(row=>row.plays>0).sort((a,b)=>b.score-a.score).slice(0,20);}
 close(){this.db.close();}
}
module.exports={Store,names};
