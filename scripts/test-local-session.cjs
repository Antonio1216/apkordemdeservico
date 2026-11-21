'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let resolveLogin;
const ctx={structuredClone,Object,Error,Boolean,Array,Promise,
  ACRLocalAuthPrototype:{authenticate:()=>new Promise(resolve=>{resolveLogin=resolve})}};
ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync('scripts/local-session-v1.js','utf8'),ctx,{timeout:3000});
const session=ctx.ACRLocalSession;
(async()=>{
  assert.equal(session.getUser(),null);
  assert.equal(session.hasPermission('ordens'),false);
  const pending=session.signIn('teste','segredo');
  session.signOut();
  resolveLogin({login:'teste',perfil:'tecnico',permissions:{ordens:true}});
  await assert.rejects(pending,/cancelada/);
  assert.equal(session.getUser(),null);
  const next=session.signIn('teste','segredo');
  resolveLogin({login:'teste',perfil:'tecnico',permissions:{ordens:true,admin:false}});
  await next;
  assert.equal(session.hasPermission('ordens'),true);
  assert.equal(session.hasPermission('admin'),false);
  const user=session.getUser();user.permissions.ordens=false;
  assert.equal(session.hasPermission('ordens'),true);
  session.signOut();
  assert.equal(session.getUser(),null);
  console.log('OK: sessao efemera, logout durante login, permissoes e copia defensiva');
})().catch(e=>{console.error(e);process.exitCode=1});
