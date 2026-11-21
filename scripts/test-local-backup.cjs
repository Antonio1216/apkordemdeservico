/* Valida a protecao de backup sem acesso ao banco real. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},indexedDB:{open(){throw Error('Nao deve abrir o banco para preview ou restauracao nao confirmada.')}},structuredClone,Promise,Date,JSON,Set,Object,Error};
vm.runInNewContext(fs.readFileSync('scripts/local-store-v1.js','utf8'),context,{timeout:3000});
const store=context.window.ACRLocalStore;
const good=JSON.stringify({format:'acr-os-pro-local-backup',version:1,records:[{key:'module:workspace',value:{revision:1}}]});
const preview=store.previewBackup(good);
assert.equal(preview.recordCount,1);
assert.equal(preview.modules[0],'workspace');
assert.throws(()=>store.previewBackup('{"format":"wrong","version":1,"records":[]}'),/incompatível/);
assert.throws(()=>store.previewBackup(JSON.stringify({format:'acr-os-pro-local-backup',version:1,records:[{key:'x',value:1},{key:'x',value:2}]})),/duplicados/);
(async()=>{
  await assert.rejects(store.importBackup(good),/Confirme/);
  await assert.rejects(store.importBackup(good,{confirmReplace:false}),/Confirme/);
  console.log('OK: preview sem alteracao e restauracao exige confirmacao');
})().catch(e=>{console.error(e);process.exitCode=1});
