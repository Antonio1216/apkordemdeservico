/* Painel de diagnostico local somente leitura, protegido por sessao. */
(() => {
 'use strict';
 const MODULES=['workspace','catalog','licenses','tickets','users'];
 const permissions={workspace:'ordens',catalog:'equipamentos',licenses:'licencas',tickets:'chamados',users:'admin'};
 async function snapshot() {
  const session=globalThis.ACRLocalSession, modules=globalThis.ACRLocalModules;
  if(!session?.getUser() || !modules?.read) throw Error('Sessao local autenticada necessaria.');
  const user=session.getUser();
  const result={};
  for(const name of MODULES) {
   if(!session.hasPermission(permissions[name]))continue;
   const data=await modules.read(name);
   if(session.getUser()?.login!==user.login)throw Error('Sessao alterada durante a consulta.');
   result[name]={revision:data.revision,collections:Object.fromEntries(
    Object.entries(data).filter(([key,value])=>key!=='revision' && Array.isArray(value))
     .map(([key,value])=>[key,value.length]))};
  }
  if(!session.getUser())throw Error('Sessao encerrada.');
  return result;
 }
 Object.defineProperty(globalThis,'ACRLocalDiagnostics',{
  value:Object.freeze({snapshot}),configurable:false,writable:false
 });
})();
