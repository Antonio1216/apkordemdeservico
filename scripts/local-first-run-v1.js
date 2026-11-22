/* Cadastro inicial local para instalação NOVA. Não substitui auth.js até integração validada. */
(()=>{'use strict';
 const store=globalThis.ACRLocalStore,pass=globalThis.ACRLocalPassword;
 if(!store||!pass)throw Error('Armazenamento e criptografia locais necessários.');
 const KEY='local-auth:user:';
 function normalize(login){const s=String(login||'').trim().toLowerCase();if(!/^[a-z0-9._@-]{3,100}$/.test(s))throw Error('Usuário inválido.');return s;}
 async function status(){
  const rows=await store.entries();
  const accounts=rows.filter(x=>x.key.startsWith(KEY));
  return Object.freeze({hasAccounts:accounts.length>0,isFresh:rows.length===0,recordCount:rows.length});
 }
 async function createFirstAdmin({login,password,name}){
  const user=normalize(login);
  const fullName=String(name||'').trim();
  if(fullName.length<3||fullName.length>140)throw Error('Informe o nome do administrador.');
  if(typeof password!=='string'||password.length<12)throw Error('Senha deve ter pelo menos 12 caracteres.');
  const state=await status();
  if(!state.isFresh)throw Error('Banco não está vazio. Cadastro inicial bloqueado para evitar perda ou substituição de contas.');
  const verifier=await pass.createVerifier(password);
  await store.createFirstAdminAtomic(KEY+user,{schema:1,login:user,nome:fullName,perfil:'Administrador',permissions:{admin:true},verifier,createdAt:new Date().toISOString()});
  return Object.freeze({login:user,nome:fullName,perfil:'Administrador'});
 }
 Object.defineProperty(globalThis,'ACRLocalFirstRun',{value:Object.freeze({status,createFirstAdmin}),configurable:false,writable:false});
})();
