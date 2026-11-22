/* Testes de cadastro inicial local: sem contas predefinidas nem bypass. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/local-first-run-v1.js','utf8');
const rows=new Map();
let calls=0;
const store={
 entries:async()=>[...rows].map(([key,value])=>({key,value})),
 createFirstAdminAtomic:async(key,value)=>{
  calls++;
  if(rows.size)throw Error('Banco não está vazio.');
  rows.set(key,value);
 }
};
const ctx={Object,Date,Error,globalThis:null,ACRLocalStore:store,ACRLocalPassword:{createVerifier:async password=>({schema:1,hash:'test-only',length:password.length})}};
ctx.globalThis=ctx;vm.runInNewContext(source,ctx);
const api=ctx.ACRLocalFirstRun;
(async()=>{
 assert.equal((await api.status()).isFresh,true);
 await assert.rejects(api.createFirstAdmin({login:'admin',password:'short',name:'Teste'}),/12 caracteres/);
 assert.equal(calls,0);
 const created=await api.createFirstAdmin({login:'Admin',password:'senha-forte-123',name:'Administrador Local'});
 assert.equal(created.login,'admin');
 assert.equal(rows.get('local-auth:user:admin').perfil,'Administrador');
 assert.equal((await api.status()).isFresh,false);
 await assert.rejects(api.createFirstAdmin({login:'outro',password:'senha-forte-123',name:'Outro Admin'}),/Banco não está vazio/);
 assert.equal(calls,1);
 console.log('OK: primeiro acesso, senha mínima, conta única e bloqueio de recriação.');
})().catch(e=>{console.error(e);process.exitCode=1});
