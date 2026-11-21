'use strict';
// Preflight for an offline migration. Read-only: never imports, deletes,
// provisions accounts or replaces the currently installed application's data.
(function(root) {
  function inspect(snapshot) {
    const issues=[];
    if (!snapshot || typeof snapshot!=='object' || Array.isArray(snapshot)) issues.push('Formato inválido');
    const accounts=Array.isArray(snapshot?.accounts)?snapshot.accounts:null;
    if (!accounts) issues.push('Lista de usuários ausente');
    const seen=new Set();
    let admins=0;
    for (const account of accounts||[]) {
      if (!account || typeof account!=='object') {issues.push('Usuário inválido');continue;}
      if(typeof account.login!=='string'||!account.login.trim()) issues.push('Login ausente');
      else {
        const key=account.login.trim().toLowerCase();
        if(seen.has(key)) issues.push('Login duplicado');
        seen.add(key);
      }
      if(account.perfil==='Administrador' && account.active!==false) admins++;
      if(!account.hash || !account.salt) issues.push('Verificador de senha ausente');
    }
    if(!admins) issues.push('Nenhum administrador ativo');
    return Object.freeze({safeToMigrate:issues.length===0,issues:Object.freeze(issues),accounts:accounts?.length||0,administrators:admins});
  }
  if(typeof module==='object'&&module.exports) module.exports={inspect};
  else Object.defineProperty(root,'ACRMigrationPreflight',{value:Object.freeze({inspect}),configurable:false});
})(typeof globalThis!=='undefined'?globalThis:this);
