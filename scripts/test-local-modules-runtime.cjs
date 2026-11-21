'use strict';
// Teste isolado dos repositórios locais: não altera o aplicativo nem dados reais.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const filename = path.join(__dirname, 'local-modules-v1.js');
const values = new Map();
const window = {
  ACRLocalStore: {
    async get(k) { return values.has(k) ? structuredClone(values.get(k)) : null; },
    async set(k,v) { values.set(k,structuredClone(v)); },
    async remove(k) { values.delete(k); }
  }
};
vm.runInNewContext(fs.readFileSync(filename,'utf8'), {window,structuredClone,Map,Promise,Error,Object,Number}, {filename});
const {read,save,resetModule} = window.ACRLocalModules;
(async () => {
  const modules=['workspace','catalog','licenses','tickets','users'];
  for(const name of modules) {
    const initial=await read(name);
    assert.equal(initial.revision,0);
    const next=await save(name,{...initial, testRecord:'persisted'},0);
    assert.equal(next.revision,1);
    assert.equal((await read(name)).testRecord,'persisted');
    await assert.rejects(save(name,{revision:0},0),/alterados/);
    await resetModule(name);
    assert.equal((await read(name)).revision,0);
  }
  await assert.rejects(read('unknown'),/desconhecido/);
  console.log('OK: leitura, gravação, revisão, conflito e reset dos cinco módulos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
