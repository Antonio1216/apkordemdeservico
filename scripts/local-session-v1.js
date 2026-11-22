/* Sessão local em memória: não persiste senha, token ou privilégios.
 * A sessão NÃO autoriza chamadas aos módulos remotos; integração pendente.
 */
(()=>{'use strict';
 const auth=globalThis.ACRLocalAuthPrototype;
 if(!auth)throw Error('Autenticação local não carregada.');
 let session=null;
 const listeners=new Set();
 const notify=()=>{for(const listener of listeners){try{listener(session?{...session}:null)}catch(_){}}};
 async function signIn(login,password){
  session=null;notify();
  const user=await auth.authenticate(login,password);
  session=Object.freeze({login:user.login,perfil:user.perfil,permissions:structuredClone(user.permissions),startedAt:new Date().toISOString()});
  notify();
  return {...session};
 }
 function signOut(){session=null;notify();}
 function current(){return session?{...session,permissions:structuredClone(session.permissions)}:null;}
 function subscribe(fn){if(typeof fn!=='function')throw Error('Listener inválido.');listeners.add(fn);return()=>listeners.delete(fn);}
 Object.defineProperty(globalThis,'ACRLocalSession',{value:Object.freeze({signIn,signOut,current,subscribe}),configurable:false,writable:false});
})();
