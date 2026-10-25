'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {teamApi}=require('../team-api');

test('API multi-domínio: autenticação ACR, allowlist e isolamento de aparelhos',async()=>{
  const prevEmail=process.env.RHID_LOGIN_EMAIL,prevPassword=process.env.RHID_LOGIN_PASSWORD;
  process.env.RHID_LOGIN_EMAIL='api-multidominio@teste.invalid';
  process.env.RHID_LOGIN_PASSWORD='senha-ficticia-multi';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acr-domains-api-'));
  const calls=[];
  const json=data=>({ok:true,status:200,text:async()=>JSON.stringify(data),
    headers:{get:k=>k==='content-type'?'application/json':''}});
  const mock=async(url,opts)=>{
    if(opts.method==='POST'){
      const data=JSON.parse(opts.body);
      calls.push({route:'login',domain:data.domain||''});
      return json({accessToken:'token-'+(data.domain||'discovery'),
        ...(data.domain?{}:{listCustomer:[
          {id:1,domain:'cliente_a',name:'Cliente A'},{id:2,domain:'cliente_b',name:'Cliente B'}]})});
    }
    calls.push({route:'device',token:opts.headers.Authorization});
    const domain=opts.headers.Authorization.replace('Bearer token-','');
    return json({records:[{id:1,name:'Relogio',serial:'REP-'+domain,status:'online'}]});
  };
  const key='x'.repeat(40);
  const api=teamApi({key,dbfile:path.join(dir,'team.json'),rhidFetch:mock});
  const server=http.createServer((req,res)=>api.handle(req,res,new URL(req.url,'http://localhost').pathname));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function request(route,token,method='GET',body,admin){
    const response=await fetch(base+'/api/team/'+route,{method,
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),
        ...(admin?{'X-API-Key':admin}:{})},
      body:body===undefined?undefined:JSON.stringify(body)});
    return {code:response.status,data:await response.json()};
  }
  try{
    assert.equal((await request('rhid-domains')).code,401);
    const bootstrap=await request('bootstrap',null,'POST',
      {nome:'Administrador',login:'admin.test',senha:'senha-teste'},key);
    assert.equal(bootstrap.code,201);
    const adminToken=bootstrap.data.token;
    const list=await request('rhid-domains',adminToken);
    assert.equal(list.code,200);
    assert.deepEqual(list.data.domains.map(x=>x.domain),['cliente_a','cliente_b']);
    assert.equal(JSON.stringify(list.data).includes('token-'),false);
    const outsider=await request('rhid-domains/cliente_c/devices',adminToken);
    assert.equal(outsider.code,403);
    const a=await request('rhid-domains/cliente_a/devices',adminToken);
    const b=await request('rhid-domains/cliente_b/devices',adminToken);
    assert.equal(a.code,200);assert.equal(b.code,200);
    assert.equal(a.data.devices[0].serie,'REP-cliente_a');
    assert.equal(b.data.devices[0].serie,'REP-cliente_b');
    assert.equal(a.data.devices[0].empresa,'Cliente A');
    assert.equal(b.data.devices[0].empresa,'Cliente B');
    assert.deepEqual(calls.filter(x=>x.route==='device').map(x=>x.token),
      ['Bearer token-cliente_a','Bearer token-cliente_b']);
    const created=await request('users',adminToken,'POST',
      {nome:'Técnico',login:'tecnico.test',senha:'senha-teste',perfil:'Técnico'});
    assert.equal(created.code,200);
    const login=await request('login',null,'POST',{login:'tecnico.test',senha:'senha-teste'});
    assert.equal(login.code,200);
    assert.equal((await request('rhid-domains',login.data.token)).code,403);
    assert.equal((await request('rhid-domains/cliente_a/devices',login.data.token)).code,403);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(dir,{recursive:true,force:true});
    if(prevEmail===undefined)delete process.env.RHID_LOGIN_EMAIL;else process.env.RHID_LOGIN_EMAIL=prevEmail;
    if(prevPassword===undefined)delete process.env.RHID_LOGIN_PASSWORD;else process.env.RHID_LOGIN_PASSWORD=prevPassword;
  }
});
