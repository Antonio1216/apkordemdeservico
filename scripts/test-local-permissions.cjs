/* Testes comportamentais das permissões locais: negar por padrão. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
let user=null;
const context={Object,Error,globalThis:null,ACRLocalSession:{current:()=>user}};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync('scripts/local-permissions-v1.js','utf8'),context);
const permissions=context.ACRLocalPermissions;
for(const action of permissions.known){
 assert.equal(permissions.allowed(action),false,'Sem sessão: '+action);
 assert.throws(()=>permissions.requirePermission(action),/não autorizado/);
}
user={login:'tecnico',permissions:{'os.read':true}};
assert.equal(permissions.allowed('os.read'),true);
assert.equal(permissions.allowed('os.write'),false);
assert.equal(permissions.allowed('financeiro.read'),false);
assert.equal(permissions.allowed('usuarios.manage'),false);
assert.equal(permissions.allowed('__proto__'),false);
user={login:'admin',permissions:{admin:true}};
for(const action of permissions.known)assert.equal(permissions.allowed(action),true);
user=null;
assert.equal(permissions.allowed('os.read'),false);
console.log('PASSOU: sessão ausente, menor privilégio, administrador, permissão desconhecida e logout.');
