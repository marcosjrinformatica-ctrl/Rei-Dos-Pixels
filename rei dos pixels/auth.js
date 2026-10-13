'use strict';
// A identidade vem do servidor. Senhas e tokens de sessão nunca vão para LocalStorage.
window.Account=(()=>{
 let user=null,csrf=null,available=false,mode='login',lastProgress=null,initializing=null;
 const byId=id=>document.getElementById(id);
 async function request(route,method='GET',data){let response;try{response=await fetch('/api/'+route,{method,credentials:'same-origin',headers:{...(data?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&csrf?{'X-CSRF-Token':csrf}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(30000)});}catch{throw new Error('Não foi possível conectar ao servidor. Tente novamente.');}let json;try{json=await response.json();}catch{throw new Error('O servidor não respondeu corretamente.');}if(!response.ok){if(response.status===401&&user&&!route.startsWith('auth/')){user=null;csrf=null;lastProgress=null;notify();}const err=new Error(json.error||'Não foi possível concluir a solicitação.');err.status=response.status;throw err;}return json;}
 function notify(){document.dispatchEvent(new CustomEvent('account-change',{detail:{user,progress:lastProgress,available}}));render();}
 function accept(result){user=result.user;csrf=result.csrf;lastProgress=result.data||null;if(user&&byId('profileDialog').open)byId('profileDialog').close();notify();}
 function status(message,isError=false){byId('authStatus').textContent=message;byId('authStatus').classList.toggle('error',isError);}
 function setMode(next){mode=next;byId('authLoginTab').setAttribute('aria-selected',mode==='login');byId('authRegisterTab').setAttribute('aria-selected',mode==='register');byId('authNameField').hidden=mode!=='register';byId('authName').required=mode==='register';byId('authPassword').autocomplete=mode==='register'?'new-password':'current-password';byId('authSubmit').textContent=mode==='register'?'CRIAR CONTA':'ENTRAR';status('');}
 function render(){byId('authServerNotice').hidden=available;byId('authSubmit').disabled=!available;document.querySelectorAll('[data-auth]').forEach(b=>{b.textContent=b.id==='saveAction'?'SALVAR NOVAS PARTIDAS NA CONTA':user?'MINHA CONTA':'ENTRAR / CADASTRAR';if(b.closest('#profileDialog'))b.hidden=!!user;});byId('logout').hidden=!user;byId('accountIdentity').textContent=user?`${user.email} · E-MAIL E SENHA`:'VISITANTE · PROGRESSO SALVO NESTE NAVEGADOR';}
 async function initialize(){
  if(initializing)return initializing;
  if(!['http:','https:'].includes(location.protocol)){render();notify();status('Você abriu o arquivo index.html. Para criar sua conta ou entrar, abra INICIAR FLIPERAMA.cmd e use o site em http://localhost:3000.',true);byId('authRetry').hidden=true;return;}
  initializing=(async()=>{try{const [config,me]=await Promise.all([request('config'),request('me')]);available=!!config.accounts;accept(me);if(available)status('');}catch(error){available=false;render();notify();status(error.message+' Use TENTAR CONEXÃO para reconectar.',true);}
   finally{initializing=null;}
   const params=new URLSearchParams(location.search);if(params.has('auth')||params.has('auth_error')){params.delete('auth');params.delete('auth_error');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
  })();return initializing;
 }
 function open(next='login'){setMode(next);render();byId('authDialog').showModal();if(!available)void initialize();}
 byId('authRetry').onclick=async()=>{byId('authRetry').disabled=true;status('Conectando…');try{await initialize();}finally{byId('authRetry').disabled=false;}};
 window.addEventListener('online',()=>{if(!available)void initialize();});
 async function logout(){try{await request('auth/logout','POST',{});}catch(error){if(error.status!==401)throw error;}user=null;csrf=null;lastProgress=null;notify();}
 byId('authLoginTab').onclick=()=>setMode('login');byId('authRegisterTab').onclick=()=>setMode('register');
 byId('authForm').onsubmit=async event=>{event.preventDefault();if(!available)return;const button=byId('authSubmit');button.disabled=true;status('Conectando…');try{const result=await request('auth/'+(mode==='register'?'register':'login'),'POST',{name:byId('authName').value.trim(),email:byId('authEmail').value.trim(),password:byId('authPassword').value});byId('authPassword').value='';accept(result);byId('authDialog').close();document.dispatchEvent(new CustomEvent('account-toast',{detail:mode==='register'?'CONTA CRIADA':'LOGIN CONCLUÍDO'}));}catch(error){status(error.message,true);}finally{button.disabled=!available;}};
 byId('logout').onclick=async()=>{try{await logout();byId('profileDialog').close();document.dispatchEvent(new CustomEvent('account-toast',{detail:'VOCÊ SAIU DA CONTA'}));}catch(error){document.dispatchEvent(new CustomEvent('account-toast',{detail:error.message}));}};
 byId('authGuest').onclick=()=>byId('authDialog').close();document.querySelectorAll('[data-auth]').forEach(button=>button.onclick=()=>user?document.querySelector('[data-profile]').click():open());
 return {initialize,open,get user(){return user},get available(){return available},get progress(){return lastProgress},async rename(name){const result=await request('profile','POST',{name});user={...user,name};lastProgress=result.data;notify();return result;},startRun:gameId=>request('runs','POST',{gameId}),finishRun:data=>request('runs/finish','POST',data),purchase:item=>request('shop','POST',{item}),leaderboard:game=>request('leaderboard?game='+encodeURIComponent(game))};
})();
