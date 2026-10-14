'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../rhid-monitor');
const json=(value)=>({ok:true,status:200,headers:{get:key=>key==='content-type'?'application/json':'0'},text:async()=>JSON.stringify(value)});
const data={records:[{id:123,name:'REP Entrada',serial:'123ABC',status:'online'}]};
const opts={email:'tecnico-integracao@empresa.test',password:'senha-forte-integração-123',domain:'cliente-acr',url:m.DEFAULT_URL};
test('POST /login only on RHiD official host, never leak password to GET device',async()=>{
 const calls=[];
 const value=await m.readDevices({...opts,fetcher:async(url,req)=>{
  calls.push({url,req});
  if(req.method==='POST')return json({accessToken:'teste-token-automatico-123456789',expiredPassword:false});
  assert.equal(req.method,'GET');
  assert.equal(req.headers.Authorization,'Bearer teste-token-automatico-123456789');
  assert.ok(!JSON.stringify(req).includes(opts.password));
  return json(data);
 }});
 assert.equal(value.configured,true);assert.equal(value.devices[0].status,'online');
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,'https://www.rhid.com.br/v2/api.svc/login');
 assert.equal(calls[0].req.redirect,'error');
 assert.deepEqual(JSON.parse(calls[0].req.body),{email:opts.email,password:opts.password,domain:opts.domain,system:'rhid'});
 assert.equal(calls[1].url,m.DEFAULT_URL);
});
test('token do login é reutilizado até expiração, sem repetir senha a cada consulta',async()=>{
 let login=0,device=0;
 const fetcher=async(url,req)=>{
  if(req.method==='POST'){login++;return json({accessToken:'teste-token-automatico-123456789'});}
  device++;return json(data);
 };
 await m.readDevices({...opts,fetcher});
 await m.readDevices({...opts,fetcher});
 assert.equal(login,0);
 assert.equal(device,2);
});
test('API 401 renova token apenas uma vez e repete GET /device',async()=>{
 let login=0,gets=0;
 const result=await m.readDevices({...opts,fetcher:async(url,req)=>{
  if(req.method==='POST'){login++;return json({accessToken:'renovado-token-123456789-abc'});}
  gets++;if(gets===1)return {ok:false,status:401};
  assert.equal(req.headers.Authorization,'Bearer renovado-token-123456789-abc');
  return json(data);
 }});
 assert.equal(result.devices.length,1);assert.equal(login,1);assert.equal(gets,2);
});
test('falha segura: token inválido e host não oficial não chegam à API',async()=>{
 await assert.rejects(()=>m.readDevices({...opts,url:'https://attacker.test/device',fetcher:()=>{throw Error('fetch inesperado');}}),/inválido/);
 await assert.rejects(()=>m.readDevices({...opts,email:'segredo\ninjetado',fetcher:()=>{throw Error('fetch inesperado');}}),/inválidas/);
 let count=0;await assert.rejects(()=>m.readDevices({...opts,email:'novo@empresa.test',fetcher:async(url,req)=>{
  count++;return {ok:false,status:403};
 }}),/recusou o login/);assert.equal(count,1);
});
test('login RHiD aceita resposta JSON com envelope Swagger ou sem ele',async()=>{
 const result=await m.readDevices({...opts,email:'formato-envelope@empresa.test',fetcher:async(url,req)=>{
  if(req.method==='POST')return json({'application/json':{accessToken:'token-format-wrapper-123456789'}});
  return json(data);
 }});
 assert.equal(result.devices.length,1);
});
