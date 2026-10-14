/* Android ACR OS Pro: login recovery + admin Microsoft Authenticator setup. */
(() => {
'use strict';
const BASE='https://acr-os-pro-backend.onrender.com';
const html=(str)=>{const t=document.createElement('template');t.innerHTML=str;return t.content;};
async function post(path,data){
 const r=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(j.error||'Falha na solicitação.');
 return j;
}
function wire(form,action,status){
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;status.textContent='Aguarde...';
  try{status.textContent=await action(new FormData(form));}catch(err){status.textContent=err.message;}
  finally{button.disabled=false;}
 });
}
function initRecovery(){
 const login=document.getElementById('auth-login');
 if(!login)return;
 const btn=document.createElement('button');
 btn.textContent='Esqueci minha senha';btn.type='button';btn.className='outline';
 login.append(btn);
 const wrap=document.createElement('section');wrap.hidden=true;wrap.id='login-recovery-panel';
 wrap.setAttribute('aria-label','Redefinição de senha');
 wrap.append(html([
  '<h2>Recuperar acesso</h2>',
  '<p><button type="button" id="recovery-user-btn">E-mail (usuários)</button> ',
  '<button type="button" id="recovery-admin-btn">Microsoft Authenticator (administrador)</button></p>',
  '<form id="email-recovery"><label>E-mail cadastrado <input type="email" name="email" required maxlength="254"></label>',
  '<button class="primary" type="submit">Receber link por e-mail</button></form>',
  '<form id="admin-recovery" hidden>',
  '<label>Login do admin <input name="login" autocomplete="username" required maxlength="254"></label>',
  '<label>Código do Authenticator <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label>',
  '<label>Nova senha (mínimo 12 caracteres) <input name="senha" type="password" minlength="12" maxlength="128" required></label>',
  '<label>Confirmar senha <input name="confirmar" type="password" minlength="12" maxlength="128" required></label>',
  '<button class="primary" type="submit">Redefinir senha do admin</button></form>',
  '<p id="recovery-msg" role="status" aria-live="polite"></p>',
  '<button type="button" id="recovery-back" class="outline">Voltar ao login</button>'
 ].join('')));
 login.insertAdjacentElement('afterend',wrap);
 const email=wrap.querySelector('#email-recovery'),admin=wrap.querySelector('#admin-recovery'),msg=wrap.querySelector('#recovery-msg');
 btn.onclick=()=>{login.hidden=true;wrap.hidden=false;};
 wrap.querySelector('#recovery-back').onclick=()=>{wrap.hidden=true;login.hidden=false;msg.textContent='';};
 wrap.querySelector('#recovery-user-btn').onclick=()=>{email.hidden=false;admin.hidden=true;msg.textContent='';};
 wrap.querySelector('#recovery-admin-btn').onclick=()=>{email.hidden=true;admin.hidden=false;msg.textContent='';};
 wire(email,async f=>(await post('/api/team/password-reset/request',{email:String(f.get('email')||'').trim()})).message,msg);
 wire(admin,async f=>{
  if(f.get('senha')!==f.get('confirmar'))throw Error('As senhas não coincidem.');
  await post('/api/team/admin-totp/recover',{login:String(f.get('login')||'').trim(),code:String(f.get('code')||''),senha:f.get('senha')});
  admin.reset();return 'Senha redefinida. Volte ao login.';
 },msg);
}
async function initAuthenticator(){
 if(!window.OSAuth?.isAdmin?.())return;
 const users=document.getElementById('usuarios');
 if(!users)return;
 const panel=document.createElement('div');panel.className='panel';panel.id='admin-authenticator-panel';
 panel.append(html([
  '<h2>Microsoft Authenticator — Administrador</h2>',
  '<p>Cadastre seu Authenticator enquanto ainda sabe sua senha. Este método é exclusivo para recuperar a senha de administradores.</p>',
  '<p id="mfa-status" role="status" aria-live="polite"></p>',
  '<form id="mfa-setup" hidden>',
  '<label>Senha atual do admin <input name="senha" type="password" autocomplete="current-password" required></label>',
  '<button type="submit" class="primary">Configurar autenticador</button></form>',
  '<div id="mfa-step" hidden><p>No Microsoft Authenticator, adicione outra conta e informe a chave de configuração:</p>',
  '<p style="overflow-wrap:anywhere"><strong id="mfa-secret"></strong></p>',
  '<form id="mfa-confirm">',
  '<label>Código gerado no aplicativo <input name="code" pattern="[0-9]{6}" inputmode="numeric" maxlength="6" required></label>',
  '<button type="submit" class="primary">Confirmar e ativar</button></form></div>'
 ].join('')));
 users.append(panel);
 const status=panel.querySelector('#mfa-status'),setup=panel.querySelector('#mfa-setup');
 try{
  const state=await window.OSAuth.totpStatus();
  if(state.enabled){status.textContent='Authenticator ativado para este administrador.';return;}
  setup.hidden=false;status.textContent='Ainda não configurado.';
 }catch{status.textContent='Não foi possível verificar a configuração.';return;}
 wire(setup,async f=>{
  const value=await window.OSAuth.totpSetup(String(f.get('senha')||''));
  setup.reset();panel.querySelector('#mfa-secret').textContent=value.secret;
  panel.querySelector('#mfa-step').hidden=false;
  return 'Digite o código exibido no Authenticator para confirmar.';
 },status);
 wire(panel.querySelector('#mfa-confirm'),async f=>{
  await window.OSAuth.totpConfirm(String(f.get('code')||''));
  panel.querySelector('#mfa-secret').textContent='';
  panel.querySelector('#mfa-step').hidden=true;setup.hidden=true;
  return 'Microsoft Authenticator ativado com sucesso.';
 },status);
}
document.addEventListener('DOMContentLoaded',()=>{
 initRecovery();
 window.OSAuth?.ready?.then(initAuthenticator).catch(()=>{});
});
})();