'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const m=require('../rhid-monitor');
const payload={totalRecords:3,records:[
  {id:55,name:'REP da Portaria',serial:'REP-123',status:'online',version:'4.1',linkedCompanyId:17,lastConnectionDate:'2026-10-13T19:00:00Z'},
  {id:56,name:'Relógio Administrativo',serial:'REP-456',status:'offline',lastSyncDate:'2026-10-10T10:00:00Z'},
  {id:57,name:'Sem status',serial:'REP-789',status:'?',lastConnectionDate:'2026-10-12T13:00:00Z'}]};
test('documentação RHiD: GET /device normaliza estados, seriais, datas e associa patrimônio',()=>{
 const dev=m.normalize(payload);assert.equal(dev.length,3);
 assert.equal(dev[0].status,'online');assert.equal(dev[1].status,'offline');assert.equal(dev[2].status,'desconhecido');
 const enriched=m.associate(dev,[{id:'eq1',serie:'rep-123',empresaId:'c1'}],[{id:'c1',nome:'Empresa T.I.'}]);
 assert.equal(enriched[0].empresa,'Empresa T.I.');assert.equal(enriched[1].empresa,'Não vinculada');
 assert.deepEqual(m.summary(enriched),{total:3,online:1,offline:1,unknown:1});
 assert.equal(m.normalize({records:[]}).length,0);
 assert.throws(()=>m.normalize({error:'unauthorized'}),/Formato/);
 assert.throws(()=>m.normalize({records:[{id:4},{id:4}]}),/duplicados/);
 assert.throws(()=>m.endpoint('http://localhost:8181/device'),/inválido/);
 assert.throws(()=>m.endpoint('https://www.rhid.com.br.evil.test/v2/api/device'),/inválido/);
 assert.throws(()=>m.endpoint('https://www.rhid.com.br/v2/api/device?token=abc'),/inválido/);
 assert.equal(m.endpoint('https://www.rhid.com.br/v2/api/device'),'https://www.rhid.com.br/v2/api/device');
});
test('consulta faz GET somente no domínio autorizado e mantém Bearer fora da resposta',async()=>{
 let invoked=0;
 const result=await m.readDevices({token:'secret-token-test',fetcher:async(url,opts)=>{
  invoked++;assert.equal(url,m.DEFAULT_URL);assert.equal(opts.method,'GET');
  assert.equal(opts.headers.Authorization,'Bearer secret-token-test');
  assert.equal(opts.redirect,'error');
  return {ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':'0'},text:async()=>JSON.stringify(payload)};
 }});
 assert.equal(invoked,1);assert.equal(result.configured,true);assert.equal(result.devices.length,3);
 assert.equal((await m.readDevices({token:'',fetcher:()=>{throw Error('Não pode acessar API sem chave');}})).configured,false);
 await assert.rejects(()=>m.readDevices({token:'bad\nnew-header',fetcher:()=>{throw Error('called');}}),/inválido/);
 await assert.rejects(()=>m.readDevices({token:'secret',fetcher:async()=>({ok:false,status:401})}),/Token RHiD/);
});
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'acr-rhid-'));
const port=29000+Math.floor(Math.random()*10000),base='http://127.0.0.1:'+port,key='rhid-test-admin-key-'+('z'.repeat(40));
const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,
 PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,
 RHID_API_TOKEN:'',TEAM_DATA_FILE:path.join(folder,'team.json'),DATA_FILE:path.join(folder,'requests.json')},stdio:'ignore'});
after(()=>{proc.kill();fs.rmSync(folder,{recursive:true,force:true});});
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,60));}throw Error('Servidor indisponível');}
async function api(p,method='GET',body,token='',secret=''){
 const result=await fetch(base+'/api/team/'+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(secret?{'X-API-Key':secret}:{})},body:body?JSON.stringify(body):undefined});
 return {status:result.status,data:await result.json()};
}
test('monitoramento exige login e permissão; sem token mostra configuração pendente sem vazar dados',async()=>{
 await ready();
 let x=await api('rhid-monitor');assert.equal(x.status,401);
 const admin=await api('bootstrap','POST',{nome:'Admin RHiD Teste',login:'rhidadmin',senha:'senha-teste-123'},'',key);
 assert.equal(admin.status,201);const token=admin.data.token;
 x=await api('rhid-monitor','GET',undefined,token);
 assert.equal(x.status,200);assert.equal(x.data.configured,false);
 assert.deepEqual(x.data.devices,[]);assert.equal(x.data.summary.online,0);
 const u=await api('users','POST',{nome:'Tecnico RHiD',login:'rhidtech',perfil:'Técnico',senha:'senha12345'},token);
 assert.equal(u.status,200);const id=u.data.user.id;
 let tech=(await api('login','POST',{login:'rhidtech',senha:'senha12345'})).data.token;
 assert.equal((await api('rhid-monitor','GET',undefined,tech)).status,403);
 assert.equal((await api('users/'+id+'/permissions','PUT',{permissions:{rhid:true}},token)).status,200);
 assert.equal((await api('rhid-monitor','GET',undefined,tech)).status,401);
 tech=(await api('login','POST',{login:'rhidtech',senha:'senha12345'})).data.token;
 assert.equal((await api('rhid-monitor','GET',undefined,tech)).status,200);
 assert.equal((await api('rhid-monitor','POST',{foo:'bar'},tech)).status,404);
 const disk=JSON.parse(fs.readFileSync(path.join(folder,'team.json'),'utf8'));
 assert.equal(disk.accounts.length,2);
 assert.equal(disk.rhidMonitor.events.length,0);
});
