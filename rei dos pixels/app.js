'use strict';
// Resultados locais, sem jogadores ou placares pre-carregados.
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const KEY = 'rei-dos-pixels:v2';
const GAME_NAMES = ['Pixel Serpent','Ghost Byte','Neon Invaders','Brick Kingdom','Turbo Pixel 99','Bomb Maze','Dungeon Fighter 2000','Pixel Crossing','Cyber Arena','King of Pixels'];
const ACCENTS = ['#39ff14','#ff00c8','#00f5ff','#ffd600','#00f5ff','#ff7a00','#ff00c8','#39ff14','#00f5ff','#ffd600'];
const GENRES = ['Labirinto + serpente','Labirinto + sobrevivência','Space shooter + roguelite','Fortaleza + chefes','Corrida + sobrevivência','Bombas + masmorra','Combate + evolução','Travessia + plataforma','Arena + combate','O desafio da coroa'];
const fresh = () => ({version:2,name:'',coins:0,xp:0,time:0,fragments:[],achievements:[],records:{},history:[],audio:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,owned:[],skin:'#39ff14'});
let state = fresh();
let guestState,activeAccountId=null,remoteRun=null,rankingRequest=0;
const natural = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
try {
 const saved = JSON.parse(localStorage.getItem(KEY));
 if (saved?.version === 2) {
  state = {...state,...saved}; state.name = typeof saved.name === 'string' ? saved.name.slice(0,16) : '';
  ['coins','xp','time'].forEach(k => state[k] = natural(saved[k])); state.records = {};
  for (let id=0;id<10;id++) if (saved.records?.[id]) {const r=saved.records[id];state.records[id]={best:natural(r.best),plays:natural(r.plays),wins:natural(r.wins),total:natural(r.total),time:natural(r.time),last:typeof r.last==='string'?r.last:''};}
  state.history = Array.isArray(saved.history) ? saved.history.filter(r=>Number.isInteger(r.id)&&r.id>=0&&r.id<10&&Number.isFinite(r.score)).slice(-50) : [];
  state.fragments = Array.isArray(saved.fragments) ? [...new Set(saved.fragments.filter(id=>Number.isInteger(id)&&id>=0&&id<9))] : [];
  state.achievements = Array.isArray(saved.achievements) ? saved.achievements.filter(x=>typeof x==='string') : [];
  state.owned = Array.isArray(saved.owned) ? saved.owned.filter(x=>['cyan','pink','gold'].includes(x)) : [];
  if (!/^#[0-9a-f]{6}$/i.test(state.skin)) state.skin='#39ff14';
 } else {
  const old=JSON.parse(localStorage.getItem('rei-dos-pixels:v1'));
  if (old?.version===1) {
   state.name=typeof old.name==='string'&&old.name!=='NOVATO'?old.name.slice(0,16):'';
   state.coins=natural(old.coins);state.xp=natural(old.xp);state.time=natural(old.time);state.audio=!!old.audio;state.reduced=!!old.reduced;
   if(natural(old.plays))state.records[0]={best:natural(old.best),plays:natural(old.plays),wins:0,total:0,time:natural(old.time),last:''};
   if(old.fragments?.includes('serpent'))state.fragments=[0];
   if(Array.isArray(old.owned))state.owned=old.owned.filter(x=>['cyan','pink','gold'].includes(x));
   if(/^#[0-9a-f]{6}$/i.test(old.skin))state.skin=old.skin;
   localStorage.setItem(KEY,JSON.stringify(state));
  }
 }
} catch { /* Armazenamento indisponivel: a sessao continua em memoria. */ }
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function save(){try{if(!Account.user){localStorage.setItem(KEY,JSON.stringify(state));guestState=structuredClone(state);}}catch{toast('O navegador não permitiu salvar o progresso desta sessão.');}renderState();}
let audioContext;
function beep(frequency=440){if(!state.audio)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='square';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.025,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.15);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.16);}catch{}}
window.getArcadeBest = id => state.records[id]?.best || 0;
window.getArcadeSkin = () => state.skin;
const achievements = [['first','✥','PRIMEIRA FICHA','Termine sua primeira partida.'],['serpent','◆','MESTRE DA SERPENTE','Conclua Pixel Serpent em 3D.'],['fragment','♛','PIXEL REAL','Conquiste seu primeiro fragmento.'],['ghost','♟','CAÇA-FANTASMAS','Conclua Ghost Byte.'],['arcade','★','ARCADE MASTER','Jogue as nove máquinas principais.'],['king','♛','REI DOS PIXELS','Vença o desafio final.']];
function unlock(id){if(!state.achievements.includes(id)){state.achievements.push(id);const a=achievements.find(a=>a[0]===id);if(a)toast('CONQUISTA: '+a[2]);}}
async function recordResult(result){const {id}=result;if(!Number.isInteger(id)||id<0||id>9)return;
 if(Account.user){const run=remoteRun;remoteRun=null;if(!run||run.gameId!==id||run.userId!==Account.user.id){toast('Não foi possível identificar esta partida da conta.');return;}const pending=readPending();pending.push({runId:run.id,score:natural(result.score),won:!!result.won,duration:natural(result.duration)});writePending(pending);await syncPending();return;}
 const score=natural(result.score),won=!!result.won,duration=natural(result.duration),now=new Date().toISOString();
 const record=state.records[id]||{best:0,plays:0,wins:0,total:0,time:0,last:''};const newRecord=score>record.best;
 let coins=10+(newRecord?25:0)+(won?50:0);
 if(won&&id<9&&!state.fragments.includes(id)){state.fragments.push(id);coins+=100;unlock('fragment');}
 record.best=Math.max(record.best,score);record.plays++;record.wins+=won?1:0;record.total+=score;record.time+=duration;record.last=now;state.records[id]=record;
 state.history.push({id,score,won,duration,date:now});state.history=state.history.slice(-50);state.coins+=coins;state.xp+=20+Math.min(100,Math.floor(score/100))+(won?80:0);state.time+=duration;
 unlock('first');if(won&&id===0)unlock('serpent');if(won&&id===1)unlock('ghost');if([...Array(9).keys()].every(i=>state.records[i]?.plays>0))unlock('arcade');if(won&&id===9)unlock('king');
 save();beep(won?880:180);toast(`${won?'DESAFIO CONCLUÍDO':'PARTIDA REGISTRADA'} · +${coins} PIXEL COINS`);
 if(state.fragments.length===9&&won&&id<9)setTimeout(()=>toast('THE KING HAS AWAKENED — KING OF PIXELS DESBLOQUEADO'),4300);
}
document.addEventListener('arcade-result',event=>recordResult(event.detail));
function makeCatalogue(){
 $('#games').innerHTML=GAME_NAMES.map((name,id)=>`<article class="game-card" style="--accent:${ACCENTS[id]}"><div class="game-preview" id="preview-${id}"><span class="preview-loading">3D</span></div><span class="number">${String(id+1).padStart(2,'0')} / 3D</span><h3>${name.toUpperCase()}</h3><p>${GENRES[id]}</p><small id="record-${id}"></small><button class="ready" data-game="${id}">▶ JOGAR EM 3D</button></article>`).join('');
 $('#rankingType').innerHTML='<option value="all">MEUS RECORDES</option>'+GAME_NAMES.map((name,id)=>`<option value="${id}">${name.toUpperCase()}</option>`).join('');
 $$('[data-game]').forEach(button=>button.onclick=()=>openGame(+button.dataset.game));
}
function renderState(){const records=Object.values(state.records),best=records.reduce((max,r)=>Math.max(max,r.best),0);
 $('#playerLabel').textContent=state.name||'VISITANTE';$('#profileName').textContent=state.name||'SEU PERFIL';$('#level').textContent=1+Math.floor(state.xp/100);$('#xp').value=state.xp%100;$('#xpText').textContent=`${state.xp%100} / 100 XP`;$('#coins').textContent=state.coins.toLocaleString('pt-BR');$('#fragments').textContent=`♛ ${state.fragments.length} / 9 FRAGMENTOS`;$('#heroBest').textContent=best?best.toLocaleString('pt-BR'):'—';
 $('#achievementCount').textContent=`${state.achievements.filter(id=>achievements.some(a=>a[0]===id)).length} / ${achievements.length}`;
 $('#achievements').innerHTML=achievements.map(a=>`<article class="achievement ${state.achievements.includes(a[0])?'unlocked':''}"><span>${a[1]}</span><h3>${a[2]}</h3><p>${a[3]}</p><small>${state.achievements.includes(a[0])?'DESBLOQUEADA':'▣ BLOQUEADA'}</small></article>`).join('');
 for(let id=0;id<10;id++){const r=state.records[id];$('#record-'+id).textContent=id===9&&state.fragments.length<9?`♛ ${state.fragments.length} / 9 FRAGMENTOS`:r?.plays?`RECORDE ${r.best.toLocaleString('pt-BR')} · ${r.wins} VITÓRIA${r.wins===1?'':'S'}`:'SEM PARTIDAS AINDA';const button=$(`[data-game="${id}"]`);button.textContent=id===9&&state.fragments.length<9?'▣ CONQUISTE 9 FRAGMENTOS':'▶ JOGAR EM 3D';button.classList.toggle('ready',id!==9||state.fragments.length===9);}
 window.ArcadeMusic?.setEnabled(state.audio);document.body.classList.toggle('reduced',state.reduced);$('#audio').textContent=`♫ SOM: ${state.audio?'ON':'OFF'}`;$('#audio').setAttribute('aria-pressed',state.audio);$('#effects').textContent=state.reduced?'▤ EFEITOS REDUZIDOS':'▤ REDUZIR EFEITOS';$('#effects').setAttribute('aria-pressed',state.reduced);
 $('#throneLink').textContent=state.fragments.length===9?'ENTRAR NO TRONO →':`▣ ${state.fragments.length} / 9 FRAGMENTOS`;$('#saveStatus').textContent=Account.user?(readPending().length?'Resultado aguardando sincronização':'CONTA CONECTADA · PROGRESSO SALVO NO BANCO'):'VISITANTE · PROGRESSO SALVO NESTE NAVEGADOR';$('#saveAction').hidden=!!Account.user;renderRanking();
}
async function renderRanking(){const requestId=++rankingRequest,id=$('#rankingType').value;const list=$('#rankingList');list.replaceChildren();if($('#rankingScope').value==='accounts'){$('#rankingDescription').textContent='CONTAS CADASTRADAS · SOMA DOS MELHORES PLACARES POR JOGO';const empty=document.createElement('li');empty.className='empty-ranking';empty.textContent='Carregando placares…';list.append(empty);try{if(!Account.available)throw new Error('Abra o site pelo servidor para consultar as contas.');const result=await Account.leaderboard(id);if(requestId!==rankingRequest)return;list.replaceChildren();if(!result.entries.length){empty.textContent='Nenhuma partida registrada por uma conta ainda.';list.append(empty);}result.entries.forEach((entry,i)=>{const li=document.createElement('li'),rank=document.createElement('span'),name=document.createElement('strong'),score=document.createElement('b');rank.textContent=i+1;name.textContent=entry.name;score.textContent=entry.score.toLocaleString('pt-BR');li.append(rank,name,score);list.append(li);});}catch(error){if(requestId===rankingRequest)empty.textContent=error.message;}return;}
 $('#rankingDescription').textContent=Account.user?'SEUS RECORDES DA CONTA · APENAS PARTIDAS JOGADAS':'SEUS RECORDES LOCAIS · APENAS PARTIDAS JOGADAS';const entries=Object.entries(state.records).filter(([key,r])=>r.plays>0&&(id==='all'||String(key)===id)).sort((a,b)=>b[1].best-a[1].best);
 if(!entries.length){const li=document.createElement('li');li.className='empty-ranking';li.textContent='Nenhuma partida registrada. Jogue para criar seu primeiro recorde.';list.append(li);return;}
 entries.forEach(([key,r],i)=>{const li=document.createElement('li'),rank=document.createElement('span'),name=document.createElement('strong'),score=document.createElement('b');rank.textContent=i+1;name.textContent=GAME_NAMES[key];score.textContent=r.best.toLocaleString('pt-BR');li.append(rank,name,score);list.append(li);});
}
function info(title,content){$('#infoTitle').textContent=title;$('#infoContent').innerHTML=content;$('#infoDialog').showModal();}
function openGame(id=0){if(id===9&&state.fragments.length<9){info('O TRONO AGUARDA',`<p>Você conquistou ${state.fragments.length} de 9 fragmentos. Vença cada uma das nove máquinas para desbloquear King of Pixels.</p><p>Fragmentos: ${GAME_NAMES.slice(0,9).filter((_,i)=>state.fragments.includes(i)).join(', ')||'nenhum por enquanto'}.</p>`);return;}window.Arcade3D.open(id);beep(600);}
$$('[data-profile]').forEach(button=>button.onclick=()=>{const records=Object.entries(state.records);const favorite=records.sort((a,b)=>b[1].plays-a[1].plays)[0];$('#name').value=state.name;$('#profileStats').textContent=`NÍVEL ${1+Math.floor(state.xp/100)} · ${state.xp} XP · ${state.coins} COINS · ${records.reduce((sum,[,r])=>sum+r.plays,0)} PARTIDAS · ${Math.floor(state.time/60)} MIN · ${state.fragments.length}/9 FRAGMENTOS · FAVORITO: ${favorite?GAME_NAMES[favorite[0]].toUpperCase():'JOGUE PARA DESCOBRIR'}`;$('#profileDialog').showModal();});
$('#profileForm').onsubmit=async event=>{event.preventDefault();const name=$('#name').value.trim();if(!name){$('#name').setCustomValidity('Digite seu nome de jogador.');$('#name').reportValidity();return;}try{if(Account.user)await Account.rename(name.toUpperCase());else{state.name=name.toUpperCase();save();}$('#profileDialog').close();toast('PERFIL SALVO');}catch(error){toast(error.message);}};$('#name').oninput=()=>$('#name').setCustomValidity('');
$$('dialog .close').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$('#menu').onclick=()=>{const open=$('nav').classList.toggle('open');$('#menu').setAttribute('aria-expanded',open);$('#menu').textContent=open?'×':'☰';};
$$('nav a').forEach(link=>link.onclick=()=>{$('nav').classList.remove('open');$('#menu').setAttribute('aria-expanded',false);$('#menu').textContent='☰';$$('nav a').forEach(a=>a.classList.toggle('active',a===link));});
$('#audio').onclick=()=>{state.audio=!state.audio;save();beep();};$('#effects').onclick=()=>{state.reduced=!state.reduced;save();};$('#rankingType').onchange=renderRanking;$('#rankingScope').onchange=renderRanking;
$('#about').onclick=()=>info('REI DOS PIXELS','<p>Dez jogos autorais com cenários e personagens em 3D, inspirados no fliperama dos anos 90 e 2000.</p><p>Visitantes guardam o progresso neste navegador. Jogadores conectados guardam os resultados na conta. Os placares exibem partidas registradas; nenhum jogador ou recorde é pré-carregado.</p>');
$('#shop').onclick=()=>{info('PIXEL SHOP','<p>Cores para seus personagens em 3D. Use Pixel Coins conquistadas em partidas.</p>'+[['cyan','CIANO','#00f5ff'],['pink','MAGENTA','#ff00c8'],['gold','DOURADO','#ffd600']].map(([id,label,color])=>`<p><button class="outline" data-buy="${id}" data-color="${color}">${label} · ${state.owned.includes(id)?'EQUIPAR':'100 COINS'}</button></p>`).join('')+'<p><button class="outline" id="defaultSkin">EQUIPAR VERDE ORIGINAL</button></p>');$$('[data-buy]').forEach(button=>button.onclick=async()=>{const id=button.dataset.buy;try{if(Account.user){const response=await Account.purchase(id);applyServerProgress(response.data);}else{if(!state.owned.includes(id)){if(state.coins<100){toast('Você precisa de 100 Pixel Coins.');return;}state.coins-=100;state.owned.push(id);}state.skin=button.dataset.color;save();}button.textContent='EQUIPADO';toast('Cor equipada para a próxima partida.');}catch(error){toast(error.message);}});$('#defaultSkin').onclick=async()=>{try{if(Account.user){const response=await Account.purchase('green');applyServerProgress(response.data);}else{state.skin='#39ff14';save();}toast('Verde original equipado.');}catch(error){toast(error.message);}};};
$('#crown').onclick=()=>toast('A coroa espera por nove vitórias. Complete as máquinas para conquistar os fragmentos.');
$$('[data-play]').forEach(button=>button.onclick=()=>openGame(0));$('#play').onclick=()=>openGame(0);$('#start').onclick=()=>{beep(700);$('#jogos').scrollIntoView({behavior:state.reduced?'instant':'smooth'});};$('#catalogButton').onclick=()=>$('#jogos').scrollIntoView();$('#rankButton').onclick=()=>$('#ranking').scrollIntoView();$('#throneLink').onclick=()=>openGame(9);
$$('[data-room]').forEach(button=>button.onclick=()=>{const ids=button.dataset.room.split(',').map(Number);info(button.dataset.title,'<p>Escolha uma máquina em 3D:</p>'+ids.map(id=>`<p><button class="outline" data-room-game="${id}">${GAME_NAMES[id].toUpperCase()}</button></p>`).join(''));$$('[data-room-game]').forEach(b=>b.onclick=()=>{$('#infoDialog').close();openGame(+b.dataset.roomGame);});});
function applyServerProgress(data){const preferences={audio:state.audio,reduced:state.reduced};state={...fresh(),...data,...preferences};renderState();}
function pendingKey(){return 'rei-dos-pixels:pending:'+Account.user.id;}
const pendingMemory=new Map();
function readPending(){if(!Account.user)return [];const key=pendingKey();if(pendingMemory.has(key))return pendingMemory.get(key);try{const data=JSON.parse(localStorage.getItem(key)||'[]'),queue=Array.isArray(data)?data.filter(r=>r&&typeof r.runId==='string').slice(-20):[];pendingMemory.set(key,queue);return queue;}catch{return [];}}
function writePending(data){const key=pendingKey();pendingMemory.set(key,data);try{localStorage.setItem(key,JSON.stringify(data));}catch{toast('O resultado pendente ficará na memória desta aba até ser salvo.');}}
let syncTask=null;
function syncPending(){if(syncTask)return syncTask;syncTask=(async()=>{const owner=Account.user?.id;if(!owner)return;let queue=readPending();for(const result of queue){try{const response=await Account.finishRun(result);if(Account.user?.id!==owner)return;queue=queue.filter(item=>item.runId!==result.runId);writePending(queue);applyServerProgress(response.data);if(!response.duplicate)toast(`PARTIDA SALVA NA CONTA · +${response.reward} PIXEL COINS`);}catch(error){toast('Resultado aguardando sincronização: '+error.message);$('#saveStatus').textContent='RESULTADO PENDENTE · REENTRE NA CONTA OU TENTE NOVAMENTE';return;}}})().finally(()=>syncTask=null);return syncTask;}
let prepareGeneration=0,prepareTask=Promise.resolve();
window.cancelArcadeRun=()=>{prepareGeneration++;remoteRun=null;};
window.prepareArcadeRun=gameId=>{const generation=++prepareGeneration,owner=Account.user?.id;remoteRun=null;const task=prepareTask.then(async()=>{if(generation!==prepareGeneration)return;if(!owner)return;await syncPending();if(generation!==prepareGeneration)return;if(Account.user?.id!==owner)throw new Error('A conta mudou. Inicie a partida novamente.');if(readPending().length)throw new Error('Sincronize a partida anterior antes de iniciar outra.');const result=await Account.startRun(gameId);if(generation!==prepareGeneration)return;if(Account.user?.id!==owner)throw new Error('A conta mudou. Inicie a partida novamente.');remoteRun={id:result.runId,gameId,userId:owner};});prepareTask=task.catch(()=>{});return task;};
document.addEventListener('account-change',event=>{const detail=event.detail,previous=activeAccountId;activeAccountId=detail.user?.id||null;if(previous!==activeAccountId&&$('#gameDialog').open)Arcade3D.close();if(detail.user){if(!previous)guestState=structuredClone(state);applyServerProgress(detail.progress);syncPending();}else if(previous){state=guestState||fresh();remoteRun=null;renderState();}else renderState();$('#saveAction').hidden=!!detail.user;});
document.addEventListener('account-toast',event=>toast(event.detail));window.addEventListener('online',()=>{if(Account.user)syncPending();});
makeCatalogue();renderState();Account.initialize();
async function createPreviews(){for(let id=0;id<10;id++){if($('#gameDialog').open)break;if($('#preview-'+id+' img'))continue;try{const url=window.Arcade3D.preview(id);if(url){const image=new Image();image.src=url;image.alt=`Cena 3D de ${GAME_NAMES[id]}`;$('#preview-'+id).replaceChildren(image);if(id===0)$('#featuredPreview').src=url;}}catch(error){console.warn('Pré-visualização 3D indisponível:',GAME_NAMES[id]);}await new Promise(resolve=>requestAnimationFrame(resolve));}}
$('#gameDialog').addEventListener('close',createPreviews);
createPreviews();
