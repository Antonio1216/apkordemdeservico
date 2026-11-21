'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const records=new Map();
const ctx={Object,Error,Boolean,Promise,
  ACRLocalStore:{
    get:async k=>records.has(k)?records.get(k):null,
    set:async(k,v)=>{records.set(k,v)}
  },
  ACRLocalPassword:{createVerifier:async secret=>({schema:1,hash:'fake-test-hash',length:secret.length})}
};
ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync('scripts/local-first-run-v1.js','utf8'),ctx,{timeout:3000});
const api=ctx.ACRLocalFirstRun;
(async()=>{
  assert.equal(await api.needsSetup(),true);
  await assert.rejects(api.initialize({login:'admin',secret:'SenhaDeTeste#2026'}),/Confirme/);
  assert.equal(records.size,0);
  await assert.rejects(api.initialize({login:'admin',secret:'curta',confirmNewInstallation:true}),/12 caracteres/);
  assert.equal(records.size,0);
  const user=await api.initialize({login:'Admin.Local',secret:'SenhaDeTeste#2026',confirmNewInstallation:true});
  assert.equal(user.login,'admin.local');
  assert.equal(await api.needsSetup(),false);
  const record=records.get('local-auth:user:admin.local');
  assert.equal(record.perfil,'admin');
  assert.equal(record.permissions.admin,true);
  assert.equal(JSON.stringify(record).includes('SenhaDeTeste#2026'),false);
  await assert.rejects(api.initialize({login:'other',secret:'SenhaDeTeste#2026',confirmNewInstallation:true}),/já configurado/);
  console.log('OK: inicializacao explicita, senha forte, sem senha em claro e sem segunda conta admin');
})().catch(e=>{console.error(e);process.exitCode=1});
