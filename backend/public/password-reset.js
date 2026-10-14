'use strict';
const $=s=>document.querySelector(s),msg=$('#msg');
let resetToken=new URLSearchParams(location.hash.slice(1)).get('token')||'';
if(resetToken){
 history.replaceState(null,'',location.pathname);
 if(!/^[a-zA-Z0-9_-]{42,44}$/.test(resetToken))resetToken='';
 if(resetToken){$('#request-form').hidden=true;$('#confirm-form').hidden=false;}
}
function switchTo(admin){
 $('#user-pane').classList.toggle('active',!admin);
 $('#admin-pane').classList.toggle('active',admin);
 $('#show-user').setAttribute('aria-selected',String(!admin));
 $('#show-admin').setAttribute('aria-selected',String(admin));
 msg.textContent='';
}
$('#show-user').addEventListener('click',()=>switchTo(false));
$('#show-admin').addEventListener('click',()=>switchTo(true));
async function post(url,data){
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const json=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(json.error||'Não foi possível concluir a solicitação.');
 return json;
}
async function execute(form,job){
 const btn=form.querySelector('button[type="submit"]');
 btn.disabled=true;msg.textContent='Aguarde...';
 try{msg.textContent=await job(new FormData(form));}catch(e){msg.textContent=e.message||'Falha na solicitação.';}finally{btn.disabled=false;}
}
$('#request-form').addEventListener('submit',e=>{
 e.preventDefault();execute(e.currentTarget,async f=>{
  const x=await post('/api/team/password-reset/request',{email:String(f.get('email')||'').trim()});
  return x.message||'Se o e-mail estiver cadastrado, um link será enviado.';
 });
});
$('#confirm-form').addEventListener('submit',e=>{
 e.preventDefault();execute(e.currentTarget,async f=>{
  if(f.get('senha')!==f.get('confirmar'))throw Error('As senhas não coincidem.');
  await post('/api/team/password-reset/confirm',{token:resetToken,senha:f.get('senha')});
  resetToken='';e.currentTarget.reset();return 'Senha redefinida. Volte ao aplicativo para entrar.';
 });
});
$('#admin-form').addEventListener('submit',e=>{
 e.preventDefault();execute(e.currentTarget,async f=>{
  if(f.get('senha')!==f.get('confirmar'))throw Error('As senhas não coincidem.');
  await post('/api/team/admin-totp/recover',{login:String(f.get('login')||'').trim(),code:String(f.get('code')||''),senha:f.get('senha')});
  e.currentTarget.reset();return 'Senha de administrador redefinida. Entre novamente no aplicativo.';
 });
});