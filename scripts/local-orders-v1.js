/* Ordens locais: CRUD isolado, sem alterar os fluxos legados do Render. */
(() => {
 'use strict';
 const clean=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
 function access() {
  const s=globalThis.ACRLocalSession;
  if(!s?.getUser()||!s.hasPermission('ordens'))throw Error('Permissão para ordens de serviço necessária.');
  return s.getUser().login;
 }
 function assertSession(login) {
  if(globalThis.ACRLocalSession?.getUser()?.login!==login||
     !globalThis.ACRLocalSession.hasPermission('ordens'))throw Error('Sessão alterada; operação cancelada.');
 }
 function normalize(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Dados da OS inválidos.');
  const title=clean(input.title),client=clean(input.client),description=clean(input.description,3000);
  if(!title||!client)throw Error('Informe título e cliente.');
  const status=clean(input.status);
  if(!['aberta','em_andamento','concluida'].includes(status))throw Error('Status inválido.');
  return {title,client,description,status};
 }
 async function list() {
  const login=access(), data=await globalThis.ACRLocalModules.read('workspace');
  assertSession(login);
  return structuredClone(data.orders);
 }
 async function create(input) {
  const login=access(), fields=normalize(input),modules=globalThis.ACRLocalModules;
  const current=await modules.read('workspace');assertSession(login);
  const now=new Date().toISOString();
  const id=globalThis.crypto?.randomUUID?.();
  if(!id)throw Error('Gerador seguro de identificadores indisponível.');
  const record={id,...fields,createdAt:now,updatedAt:now,createdBy:login};
  current.orders.push(record);
  assertSession(login);
  await modules.save('workspace',current,current.revision);
  return structuredClone(record);
 }
 async function update(id,input) {
  const login=access(), fields=normalize(input),modules=globalThis.ACRLocalModules;
  if(typeof id!=='string'||!id)throw Error('Identificador inválido.');
  const current=await modules.read('workspace');assertSession(login);
  const index=current.orders.findIndex(o=>o.id===id);
  if(index<0)throw Error('OS não encontrada.');
  const next={...current.orders[index],...fields,updatedAt:new Date().toISOString()};
  current.orders[index]=next;
  assertSession(login);
  await modules.save('workspace',current,current.revision);
  return structuredClone(next);
 }
 Object.defineProperty(globalThis,'ACRLocalOrders',{value:Object.freeze({list,create,update}),configurable:false,writable:false});
})();
