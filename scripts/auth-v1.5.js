(() => {
'use strict';
const KEY='ospro:auth:v1', SESSION='ospro:session:v1', ITERATIONS=210000;
const $=s=>document.querySelector(s);
const normalize=s=>String(s||'').trim().toLowerCase();
let db; try{db=JSON.parse(localStorage.getItem(KEY))||{v:1,accounts:[]};}catch{db={v:1,accounts:[]};}
if(!Array.isArray(db.accounts))db.accounts=[];
let current=null,resolveReady;
const ready=new Promise(r=>resolveReady=r);
const output=$('#auth-message'),screen=$('#auth-screen');
function msg(t,bad=true){output.textContent=t;output.className='auth-message'+(bad?' auth-error':'');}
function persist(){localStorage.setItem(KEY,JSON.stringify(db));}
function supported(){return !!(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);}
function id(){return crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');}
function salt(){return Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return !d;}
async function hash(password,hex){
 if(!supported())throw Error('Atualize o Android System WebView: autenticação indisponível.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),{name:'PBKDF2'},false,['deriveBits']);
 const saltBytes=new Uint8Array((hex.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:saltBytes,iterations:ITERATIONS},key,256);
 return Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,'0')).join('');
}
function loginValid(str){let value=normalize(str);if(!/^[a-z0-9._-]{3,32}$/.test(value))throw Error('O login precisa de 3 a 32 caracteres: letras, números, ponto, hífen ou _.');return value;}
function passValid(str){if(!str || str.length<6||str.length>128)throw Error('A senha precisa de 6 a 128 caracteres.');}
function active(){return db.accounts.filter(x=>x.active!==false);}
function getAccount(id){return db.accounts.find(x=>x.id===id)||null;}
function list(){return db.accounts.map(({hash:ignored,salt:ignoredSalt,...rest})=>rest);}
function isAdmin(){return current?.perfil==='Administrador';}
function anotherAdmin(id){return active().some(x=>x.perfil==='Administrador' && x.id!==id);}
async function saveUser(data){
 if(!isAdmin())throw Error('Acesso permitido apenas a administradores.');
 const login=loginValid(data.login),nome=String(data.nome||'').trim();
 if(nome.length<3||nome.length>140)throw Error('Informe o nome completo.');
 if(db.accounts.some(x=>x.login===login&&x.id!==data.id))throw Error('Este login já está cadastrado.');
 let perfil=['Administrador','Técnico','Atendimento'].includes(data.perfil)?data.perfil:'Técnico';
 let found=data.id?getAccount(data.id):null;
 if(found?.id===current.id&&perfil!=='Administrador')throw Error('Não é permitido retirar seu próprio perfil de administrador.');
 if(found?.perfil==='Administrador'&&perfil!=='Administrador'&&!anotherAdmin(found.id))throw Error('É necessário manter um administrador.');
 if(!found||data.senha)passValid(data.senha);
 const user=found||{id:data.id||id(),createdAt:new Date().toISOString()};
 user.nome=nome;user.login=login;user.perfil=perfil;user.active=true;
 if(data.senha){user.salt=salt();user.hash=await hash(data.senha,user.salt);}
 if(!found)db.accounts.push(user);
 persist();if(current?.id===user.id)current=user;
 return {id:user.id,nome:user.nome,login:user.login,perfil:user.perfil};
}
function removeUser(uid){
 if(!isAdmin())throw Error('Acesso permitido apenas a administradores.');
 const user=getAccount(uid);if(!user)return;
 if(uid===current.id)throw Error('Você não pode excluir sua própria conta.');
 if(user.perfil==='Administrador'&&!anotherAdmin(uid))throw Error('Não é possível excluir o último administrador.');
 db.accounts=db.accounts.filter(x=>x.id!==uid);persist();
}
function enter(account){
 current=account;sessionStorage.setItem(SESSION,account.id);
 screen.hidden=true;document.body.classList.remove('auth-locked');
 const label=$('#active-user-name');if(label)label.textContent=account.nome+' · '+account.perfil;
 resolveReady();
}
function logout(){sessionStorage.removeItem(SESSION);location.reload();}
function mode(){
 const first=active().length===0;$('#auth-setup').hidden=!first;$('#auth-login').hidden=first;
 $('#auth-heading').textContent=first?'Criar administrador':'Entrar no OS Pro';
 $('#auth-description').textContent=first?'Primeiro acesso neste aparelho: crie seu usuário administrador.':'Informe seu usuário e sua senha para continuar.';
 msg('',false);
}
$('#auth-setup').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
 try{
  if(active().length)throw Error('O administrador já foi configurado.');
  const nome=form.elements.namedItem('nome').value.trim(),login=loginValid(form.elements.namedItem('login').value);
  const senha=form.elements.namedItem('senha').value,confirmar=form.elements.namedItem('confirmar').value;
  if(nome.length<3)throw Error('Informe o nome completo.');passValid(senha);
  if(senha!==confirmar)throw Error('As senhas digitadas não coincidem.');
  const s=salt(),digest=await hash(senha,s);
  const admin={id:id(),nome,login,perfil:'Administrador',active:true,salt:s,hash:digest,createdAt:new Date().toISOString()};
  db.accounts=[admin];persist();form.reset();enter(admin);
 }catch(err){msg(err.message);}finally{button.disabled=false;}
});
let failures=0,lockUntil=0;
$('#auth-login').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
 try{
  if(Date.now()<lockUntil)throw Error('Aguarde um minuto antes de tentar novamente.');
  const login=normalize(form.elements.namedItem('login').value),senha=form.elements.namedItem('senha').value;
  const account=active().find(x=>x.login===login);
  const ok=account&&equal(await hash(senha,account.salt),account.hash);
  if(!ok){failures++;if(failures>=5){failures=0;lockUntil=Date.now()+60000;}throw Error('Usuário ou senha inválidos.');}
  failures=0;form.reset();enter(account);
 }catch(err){msg(err.message);}finally{button.disabled=false;}
});
window.OSAuth={ready,get current(){return current;},list,getAccount,isAdmin,saveUser,removeUser,logout};
if(!supported()){msg('Autenticação indisponível. Atualize o Android System WebView.');return;}
mode();
const previous=sessionStorage.getItem(SESSION);const saved=active().find(x=>x.id===previous);
if(saved)enter(saved);
})();