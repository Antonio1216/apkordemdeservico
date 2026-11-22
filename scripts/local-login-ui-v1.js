/* ACR OS Pro: interface experimental do primeiro acesso local.
 * Não desbloqueia o aplicativo nem substitui a sessão remota enquanto
 * os módulos de OS/Financeiro não estiverem conectados à autorização local.
 */
(()=>{'use strict';
 const first=globalThis.ACRLocalFirstRun,session=globalThis.ACRLocalSession;
 if(!first||!session)throw Error('Autenticação local indisponível.');
 const $=id=>document.getElementById(id);
 const setMessage=(message,error=false)=>{const el=$('local-auth-message');if(el){el.textContent=message;el.setAttribute('role',error?'alert':'status');}};
 async function refresh(){
  const state=await first.status();
  $('local-auth-setup').hidden=!state.isFresh;
  $('local-auth-login').hidden=state.isFresh;
 }
 function field(form,name){return String(new FormData(form).get(name)||'');}
 async function setup(event){
  event.preventDefault();
  const form=event.currentTarget;
  const password=field(form,'senha');
  if(password!==field(form,'confirmar')){setMessage('As senhas não coincidem.',true);return;}
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{
   await first.createFirstAdmin({name:field(form,'nome'),login:field(form,'login'),password});
   form.reset();setMessage('Administrador criado. Entre com sua senha para testar a autenticação local.');
   await refresh();
  }catch(e){setMessage(e.message||'Não foi possível cadastrar.',true);}
  finally{button.disabled=false;}
 }
 async function login(event){
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button[type=submit]');
  button.disabled=true;
  try{
   const user=await session.signIn(field(form,'login'),field(form,'senha'));
   form.reset();
   $('local-auth-login').hidden=true;
   $('local-auth-signout').hidden=false;
   setMessage('Sessão local iniciada para '+user.login+'. O acesso às OS e ao Financeiro ainda requer integração.');
  }catch(e){setMessage(e.message||'Não foi possível autenticar.',true);}
  finally{button.disabled=false;}
 }
 function start(){
  if(!$('local-auth-setup')||!$('local-auth-login'))return;
  $('local-auth-setup').addEventListener('submit',setup);
  $('local-auth-login').addEventListener('submit',login);
  $('local-auth-signout').addEventListener('click',()=>{session.signOut();$('local-auth-signout').hidden=true;$('local-auth-login').hidden=false;setMessage('Sessão local encerrada.');});
  refresh().catch(e=>setMessage(e.message,true));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
