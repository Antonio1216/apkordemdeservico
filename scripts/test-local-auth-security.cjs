/* Verificações de segurança do protótipo offline; não provisiona usuários. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('scripts/local-auth-prototype.js','utf8');
const records = new Map();
const context = {
  Date, Map, Error, Object, structuredClone,
  ACRLocalPassword: {verify: async (secret, verifier) => secret === 'valid-secret' && verifier === 'test-verifier'},
  ACRLocalStore: {get: async key => records.get(key)},
};
context.globalThis = context;
vm.runInNewContext(source,context,{timeout:2000});
const auth=context.ACRLocalAuthPrototype;
(async()=>{
  assert.equal(typeof auth.authenticate,'function');
  await assert.rejects(auth.provisionVerifiedUser(),/bloqueado/);
  await assert.rejects(auth.authenticate('test.user','invalid'),/inválidos/);
  records.set('local-auth:user:test.user',{schema:1,login:'test.user',perfil:'tecnico',permissions:{ordens:true},verifier:'test-verifier'});
  const user=await auth.authenticate('TEST.USER','valid-secret');
  assert.equal(user.login,'test.user');
  assert.equal(user.perfil,'tecnico');
  await assert.rejects(auth.authenticate('test.user','invalid'),/inválidos/);
  console.log('OK: autenticação isolada, negação de senha incorreta e provisionamento bloqueado');
})().catch(e=>{console.error(e);process.exitCode=1});
