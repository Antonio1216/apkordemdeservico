/* Testes reais da camada de modulos locais, sem Android ou rede. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const records=new Map();
const store={
  async get(k){return records.has(k)?structuredClone(records.get(k)):null},
  async set(k,v){records.set(k,structuredClone(v))},
  async remove(k){records.delete(k)}
};
const window={ACRLocalStore:store};
vm.runInNewContext(fs.readFileSync('scripts/local-modules-v1.js','utf8'),{
  window,structuredClone,Promise,Map,Number,Object,Error
},{timeout:3000});
const api=window.ACRLocalModules;
(async()=>{
  const initial=await api.read('workspace');
  assert.equal(initial.revision,0);
  assert.equal(initial.clients.length,0);
  const first=await api.save('workspace',{clients:[{name:'Teste'}],orders:[]},0);
  assert.equal(first.revision,1);
  first.clients[0].name='Alterado';
  assert.equal((await api.read('workspace')).clients[0].name,'Teste');
  await assert.rejects(api.save('workspace',{clients:[]},0),/alterados/);
  const operations=await Promise.allSettled([
    api.save('workspace',{clients:[{name:'A'}]},1),
    api.save('workspace',{clients:[{name:'B'}]},1)
  ]);
  assert.equal(operations.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(operations.filter(x=>x.status==='rejected').length,1);
  assert.equal((await api.read('workspace')).revision,2);
  await assert.rejects(api.read('unknown'),/desconhecido/);
  await api.resetModule('workspace');
  assert.equal((await api.read('workspace')).revision,0);
  console.log('OK: persistencia isolada, copia defensiva, revisoes, concorrencia e reset');
})().catch(e=>{console.error(e);process.exitCode=1});
