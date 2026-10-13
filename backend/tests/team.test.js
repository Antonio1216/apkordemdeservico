'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'acr-team-test-'));
const port=24000+Math.floor(Math.random()*30000),base='http://127.0.0.1:'+port;
const key='safe-test-key-'+'r'.repeat(42);
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,DATA_FILE:path.join(folder,'requests.json'),TEAM_DATA_FILE:path.join(folder,'team.json')},stdio:'ignore'});
after(()=>{child.kill();fs.rmSync(folder,{recursive:true,force:true});});
async function ready(){for(let i=0;i<60;i++){try{const res=await fetch(base+'/health');if(res.ok)return;}catch{}await new Promise(r=>setTimeout(r,65));}throw Error('Servidor não inicializou.');}
async function api(p,method='GET',data,token='',admin=''){const r=await fetch(base+'/api/team/'+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(admin?{'X-API-Key':admin}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,json:await r.json()};}
test('cadastro seguro, sessão central, perfis, sincronização com revisão e persistência',async()=>{
  await ready();let r=await api('status');assert.equal(r.json.configured,false);
  r=await api('bootstrap','POST',{nome:'Admin ACR',login:'admin@acr.com',senha:'abcdef'},'','wrongkey');assert.equal(r.status,403);
  r=await api('bootstrap','POST',{nome:'Admin ACR',login:'admin@acr.com',senha:'abcdef'},'',key);assert.equal(r.status,201);
  const adminToken=r.json.token;assert.equal(r.json.account.perfil,'Administrador');
  assert.equal((await api('bootstrap','POST',{nome:'Outro',login:'outro',senha:'abcdef'},'',key)).status,409);
  assert.equal((await api('login','POST',{login:'admin@acr.com',senha:'wrongpass'})).status,401);
  r=await api('login','POST',{login:'admin@acr.com',senha:'abcdef'});assert.equal(r.status,200);
  r=await api('users','POST',{nome:'Tecnico Um',login:'tecnico@empresa.com',perfil:'Técnico',senha:'123456'},adminToken);assert.equal(r.status,200);
  const tech=r.json.user;
  const t=(await api('login','POST',{login:'tecnico@empresa.com',senha:'123456'}));assert.equal(t.status,200);const techToken=t.json.token;
  assert.equal((await api('users','POST',{nome:'Invasor',login:'intruso',perfil:'Administrador',senha:'123456'},techToken)).status,403);
  let shared=(await api('workspace','GET',null,techToken));assert.equal(shared.status,200);assert.equal('finance' in shared.json,false);
  r=await api('workspace','PUT',{revision:0,clients:[{id:'c1',nome:'Cliente ACR'}],orders:[],drafts:[{id:'draft1',deviceId:'phone-1',status:'Em andamento'}],finance:[]},adminToken);
  assert.equal(r.status,200);assert.equal(r.json.revision,1);
  assert.equal((await api('workspace','PUT',{revision:0,clients:[],orders:[],drafts:[],finance:[]},techToken)).status,409);
  // The tech must not delete clients or orders placed by others.
  assert.equal((await api('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[]},techToken)).status,403);
  r=await api('workspace','PUT',{revision:1,clients:[{id:'c1',nome:'Cliente ACR'}],orders:[{id:'o1',numero:'OS-1',titulo:'Manutenção'}],drafts:[]},techToken);
  assert.equal(r.status,200);assert.equal(r.json.revision,2);assert.equal('finance' in r.json,false);
  shared=await api('workspace','GET',null,adminToken);assert.equal(shared.status,200);assert.equal(shared.json.orders[0].titulo,'Manutenção');assert.deepEqual(shared.json.finance,[]);
  const fail=await fetch(base+'/api/sign-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(fail.status,401);
  const ok=await fetch(base+'/api/sign-requests',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+techToken},body:JSON.stringify({orderNumber:'OS-1',clientName:'Cliente ACR',serviceTitle:'Suporte'})});assert.equal(ok.status,201);
  r=await api('users/'+tech.id,'DELETE',null,adminToken);assert.equal(r.status,200);
  assert.equal((await api('workspace','GET',null,techToken)).status,401);
  const file=JSON.parse(fs.readFileSync(path.join(folder,'team.json')));
  assert.equal(file.workspace.orders.length,1);assert.ok(!JSON.stringify(file).includes('123456'));assert.ok(!JSON.stringify(file).includes('abcdef'));
});
