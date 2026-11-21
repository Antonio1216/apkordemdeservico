'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
let current={revision:0,orders:[],clients:[],drafts:[],finance:[]};
let authorized=true;
const user={login:'admin',permissions:{ordens:true}};
const ctx={Object,Error,Array,Promise,Date,structuredClone,crypto:{randomUUID},
 ACRLocalSession:{getUser:()=>authorized?user:null,hasPermission:k=>authorized&&user.permissions[k]===true},
 ACRLocalModules:{
  read:async()=>structuredClone(current),
  save:async(name,data,rev)=>{if(name!=='workspace'||rev!==current.revision)throw Error('Conflito');current={...structuredClone(data),revision:rev+1};}
 }};
ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync('scripts/local-orders-v1.js','utf8'),ctx,{timeout:3000});
(async()=>{
 const api=ctx.ACRLocalOrders;
 await assert.rejects(api.create({title:'',client:'Empresa',status:'aberta'}),/título/);
 const a=await api.create({title:'Troca de toner',client:'Empresa',description:'Teste',status:'aberta'});
 assert.equal((await api.list()).length,1);
 assert.equal(current.revision,1);
 const b=await api.update(a.id,{title:'Troca de toner',client:'Empresa',status:'concluida'});
 assert.equal(b.status,'concluida');
 assert.equal(b.id,a.id);
 assert.equal(current.revision,2);
 authorized=false;
 await assert.rejects(api.list(),/Permissão/);
 await assert.rejects(api.create({title:'Teste',client:'Empresa',status:'aberta'}),/Permissão/);
 console.log('OK: criar, listar, editar, revisoes e permissao de OS local');
})().catch(e=>{console.error(e);process.exitCode=1});
