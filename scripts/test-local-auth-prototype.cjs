'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const records=new Map();
const context={crypto:webcrypto,TextEncoder,Uint8Array,Array,Object,Error,Map,Date,structuredClone,parseInt,globalThis:null};
context.globalThis=context;
context.ACRLocalStore={
 async get(key){return records.has(key)?structuredClone(records.get(key)):null;},
 async set(key,value){records.set(key,structuredClone(value));}
};
for(const name of ['local-password-v1.js','local-auth-prototype.js']) {
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context,{filename:name});
}
(async()=>{
 const auth=context.ACRLocalAuthPrototype;
 const user={login:'tecnico.teste',perfil:'Tecnico',permissions:{ordens:true,financeiro:false}};
 await assert.rejects(auth.provisionVerifiedUser(user,'SenhaDeTeste#2026',false),/bloqueado/);
 await assert.rejects(auth.provisionVerifiedUser(user,'SenhaDeTeste#2026',true),/bloqueado/);
 await assert.rejects(auth.authenticate(user.login,'SenhaDeTeste#2026'),/inválidos/);
 assert.equal(records.size,0,'Nenhuma conta deve ser criada sem migração autenticada');
 console.log('OK: provisionamento inseguro bloqueado; nenhuma conta criada.');
 console.log('PROTÓTIPO: não integrado ao login Android e não adequado para autorização de produção.');
})().catch(e=>{console.error(e);process.exitCode=1;});
