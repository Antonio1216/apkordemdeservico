'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const discovery=require('../rhid-domains');
const monitor=require('../rhid-monitor');
const ok=value=>({ok:true,status:200,text:async()=>JSON.stringify(value),
  headers:{get:k=>k==='content-type'?'application/json':''}});
test('listCustomer: somente domínios válidos, sem JWT ou senha na resposta',async()=>{
  const calls=[];
  const email='dominios-auto@teste.invalid',password='senha-ficticia';
  const domains=await discovery.listDomains({email,password,fetcher:async(url,request)=>{
    calls.push({url,request});
    return ok({'application/json':{accessToken:'token-privado-de-teste',listCustomer:[
      {id:11,domain:'IPH_STEF',name:'Cliente A'},{id:12,domain:'cliente_b',name:'Cliente B'},
      {domain:'../escape',name:'Inválido'},{domain:'iph_stef',name:'Duplicado'}]}});
  }});
  assert.deepEqual(domains,[{domain:'iph_stef',name:'Cliente A',id:11},{domain:'cliente_b',name:'Cliente B',id:12}]);
  assert.equal(calls[0].url,'https://www.rhid.com.br/v2/api.svc/login');
  assert.equal(calls[0].request.redirect,'error');
  assert.deepEqual(JSON.parse(calls[0].request.body),{email,password,system:'rhid'});
  assert.equal(JSON.stringify(domains).includes('token-privado'),false);
  assert.equal(JSON.stringify(domains).includes(password),false);
  await discovery.listDomains({email,password,fetcher:async()=>{throw Error('Não deveria autenticar novamente');}});
});
test('listCustomer não retornado ou login sem token causa falha fechada',async()=>{
  await assert.rejects(
    discovery.listDomains({email:'sem-lista@teste.invalid',password:'senha',fetcher:async()=>ok({accessToken:'token'})}),
    /listCustomer/);
  await assert.rejects(
    discovery.listDomains({email:'sem-token@teste.invalid',password:'senha',fetcher:async()=>ok({listCustomer:[]})}),
    /accessToken/);
  await assert.rejects(
    discovery.listDomains({email:'usuario\ninvalido',password:'senha',fetcher:()=>{throw Error('Não contactar');}}),
    /Credenciais/);
});
test('tokens e aparelhos da consulta são isolados entre dois domínios',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    if(options.method==='POST'){
      const payload=JSON.parse(options.body);
      calls.push({type:'login',domain:payload.domain});
      return ok({accessToken:'token-'+payload.domain});
    }
    calls.push({type:'get',token:options.headers.Authorization});
    const domain=options.headers.Authorization.slice('Bearer token-'.length);
    return ok({records:[{id:1,name:'Relógio '+domain,serial:domain,status:'online'}]});
  };
  const options={email:'multi-dominios-auto@teste.invalid',password:'senha-exclusiva',fetcher};
  const [a,b]=await Promise.all([
    monitor.readDevices({...options,domain:'iph_stef'}),
    monitor.readDevices({...options,domain:'cliente_b'})
  ]);
  assert.equal(a.devices[0].serie,'iph_stef');
  assert.equal(b.devices[0].serie,'cliente_b');
  assert.deepEqual(calls.filter(x=>x.type==='get').map(x=>x.token).sort(),
    ['Bearer token-iph_stef','Bearer token-cliente_b'].sort());
});
