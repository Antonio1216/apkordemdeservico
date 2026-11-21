'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const data={workspace:{revision:0,clients:[],orders:[]},catalog:{revision:0,equipments:[]}};
let allowed=true;
const ctx={Object,Array,Error,Promise,Date,structuredClone,crypto:{randomUUID},
 ACRLocalSession:{getUser:()=>allowed?{login:'admin'}:null,hasPermission:()=>allowed},
 ACRLocalModules:{
  read:async key=>structuredClone(data[key]),
  save:async(key,next,rev)=>{assert.equal(rev,data[key].revision);data[key]={...structuredClone(next),revision:rev+1}}
 }};
ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync('scripts/local-registry-v1.js','utf8'),ctx);
(async()=>{
 const api=ctx.ACRLocalRegistry;
 await assert.rejects(api.save('clients',{}),/obrigatórios/);
 const c=await api.save('clients',{name:'Cliente 1',document:'123'});
 assert.equal((await api.list('clients')).length,1);
 await api.save('clients',{name:'Cliente atualizado'},c.id);
 assert.equal((await api.list('clients'))[0].name,'Cliente atualizado');
 const e=await api.save('equipments',{name:'Notebook',type:'Computador',serial:'SN1'});
 assert.equal((await api.list('equipments'))[0].id,e.id);
 allowed=false;
 await assert.rejects(api.list('clients'),/não autorizado/);
 await assert.rejects(api.save('equipments',{name:'Teste',type:'PC'}),/não autorizado/);
 console.log('OK: clientes e equipamentos, criacao, edicao, permissao');
})().catch(e=>{console.error(e);process.exitCode=1});
