'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acr-rhid-bases-'));
const port=32000+Math.floor(Math.random()*23000);
const base='http://127.0.0.1:'+port;
const key='secret-for-tests-only-'+'9'.repeat(40);
const child=spawn(process.execPath,['server.js'],{
  cwd:path.join(__dirname,'..'),
  env:{...process.env,PORT:String(port),ADMIN_KEY:key,PUBLIC_BASE_URL:base,
    DATA_FILE:path.join(dir,'requests.json'),TEAM_DATA_FILE:path.join(dir,'team.json')},
  stdio:'ignore'
});
after(()=>{child.kill();fs.rmSync(dir,{recursive:true,force:true});});
async function ready(){
  for(let i=0;i<60;i++){
    try{const r=await fetch(base+'/health');if(r.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,80));
  }
  throw Error('Servidor ACR nao inicializou');
}
async function call(route,method='GET',data,token,adminKey){
  const r=await fetch(base+'/api/team/'+route,{
    method,headers:{'Content-Type':'application/json',
      ...(token?{Authorization:'Bearer '+token}:{}),
      ...(adminKey?{'X-API-Key':adminKey}:{})},
    body:data===undefined?undefined:JSON.stringify(data)
  });
  return {status:r.status,body:await r.json()};
}
test('dominios RHiD isolados por empresa, persistentes e apenas para administrador',async()=>{
  await ready();
  let r=await call('bootstrap','POST',{nome:'Admin RHID',login:'admin.rh',senha:'senha-segura'},null,key);
  assert.equal(r.status,201);
  const token=r.body.token;
  let company=await call('companies','POST',{nome:'Cliente de Teste A'},token);
  assert.equal(company.status,201);
  const id=company.body.company.id;
  company=await call('companies','POST',{nome:'Cliente de Teste B'},token);
  assert.equal(company.status,201);
  const other=company.body.company.id;
  r=await call('rhid-bases','GET',undefined,token);assert.equal(r.status,200);
  assert.deepEqual(r.body.bases,[]);
  assert.equal(r.body.authenticationConfigured,false);
  assert.equal((await call('rhid-bases/'+id,'PUT',{domain:'cliente.a'},null)).status,401);
  assert.equal((await call('rhid-bases/'+id,'PUT',{domain:'https://example.com'},token)).status,400);
  assert.equal((await call('rhid-bases/'+id,'PUT',{domain:'cliente.a',password:'nao-guardar'},token)).status,400);
  r=await call('rhid-bases/'+id,'PUT',{domain:'CLIENTE_A'},token);assert.equal(r.status,200);
  assert.equal(r.body.base.domain,'cliente_a');
  r=await call('rhid-bases','GET',undefined,token);assert.equal(r.status,200);
  assert.equal(r.body.bases.length,1);
  assert.equal(r.body.bases[0].companyId,id);
  assert.equal((await call('rhid-bases/'+other,'PUT',{domain:'cliente_a'},token)).status,409);
  const tech=await call('users','POST',{nome:'Tecnico RHID',login:'tecnico.rh',senha:'abcdef',perfil:'Técnico'},token);
  assert.equal(tech.status,200);
  const login=await call('login','POST',{login:'tecnico.rh',senha:'abcdef'});
  assert.equal(login.status,200);
  assert.equal((await call('rhid-bases','GET',undefined,login.body.token)).status,403);
  assert.equal((await call('rhid-bases/'+id,'PUT',{domain:'invasor'},login.body.token)).status,403);
  const persisted=JSON.parse(fs.readFileSync(path.join(dir,'team.json'),'utf8'));
  assert.equal(persisted.rhidBases[id].domain,'cliente_a');
  assert.equal('password' in persisted.rhidBases[id],false);
  assert.equal((await call('rhid-bases/'+id,'DELETE',undefined,token)).status,200);
  assert.deepEqual((await call('rhid-bases','GET',undefined,token)).body.bases,[]);
});
