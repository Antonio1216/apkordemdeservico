/* Permissões locais: nega por padrão. Ainda não integra módulos de negócio. */
(()=>{'use strict';
 const session=globalThis.ACRLocalSession;
 if(!session)throw Error('Sessão local indisponível.');
 const PERMISSIONS=Object.freeze({
  'os.read':'os.read','os.write':'os.write',
  'financeiro.read':'financeiro.read','financeiro.write':'financeiro.write',
  'usuarios.manage':'usuarios.manage'
 });
 function allowed(permission){
  if(!Object.prototype.hasOwnProperty.call(PERMISSIONS,permission))return false;
  const user=session.current();
  if(!user)return false;
  const p=user.permissions||{};
  return p.admin===true || p[permission]===true;
 }
 function requirePermission(permission){
  if(!allowed(permission))throw Error('Acesso não autorizado: '+String(permission));
  return true;
 }
 Object.defineProperty(globalThis,'ACRLocalPermissions',{value:Object.freeze({allowed,requirePermission,known:Object.keys(PERMISSIONS)}),writable:false,configurable:false});
})();
