'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const model=require('../license-utils');
const day='2026-10-13';
function license(extra={}){
 return {id:'software-lic-1',software:'Microsoft 365 Business',tipoLicenca:'Anual',unidade:'usuário',
  quantidade:12,valorUnitario:79.9,total:958.8,vencimento:'2026-10-09',status:'pendente',
  dataPagamento:'',fornecedor:'Distribuidor',empresaId:'',descricao:'Suporte, email e licença por usuário',...extra};
}
test('licença: multiplica unidades, calcula vencimento e atraso',()=>{
 const r=model.validate(license(),day);assert.equal(r.total,958.8);assert.equal(r.daysLate,4);assert.equal(r.effectiveStatus,'atrasado');
 const paid=model.evaluate(license({status:'pago',dataPagamento:'2026-10-10'}),day);
 assert.equal(paid.effectiveStatus,'pago');assert.equal(paid.daysLate,0);
 assert.equal(model.evaluate(license({vencimento:day}),day).effectiveStatus,'pendente');
 assert.equal(model.evaluate(license({vencimento:'2026-10-12'}),day).daysLate,1);
 assert.equal(model.evaluate(license({vencimento:'2026-10-14'}),day).daysLate,0);
 assert.throws(()=>model.validate(license({total:123}),day),/Total da licença/);
 assert.throws(()=>model.validate(license({vencimento:'2026-02-30'}),day),/vencimento/);
 assert.throws(()=>model.validate(license({quantidade:0}),day),/Quantidade/);
 assert.throws(()=>model.validate(license({status:'pago'}),day),/foi paga/);
 assert.throws(()=>model.validate(license({vencimento:'2026-10-14',status:'atrasado'}),day),/atrasada/);
 const sums=model.summary([license(),license({id:'2',status:'pago',dataPagamento:day,quantidade:1,valorUnitario:50,total:50}),license({id:'3',vencimento:'2026-10-20',quantidade:2,valorUnitario:19.9,total:39.8})],day);
 assert.equal(sums.licenses,3);assert.equal(sums.units,15);assert.equal(sums.total,1048.6);
 assert.equal(sums.paid,1);assert.equal(sums.pending,1);assert.equal(sums.overdue,1);assert.equal(sums.overdueDaysMax,4);
});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acr-licenses-')),port=30000+Math.floor(Math.random()*18000),base='http://127.0.0.1:'+port,key='licence-admin-key-'+('k'.repeat(40));
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,TEAM_DATA_FILE:path.join(dir,'team.json'),DATA_FILE:path.join(dir,'requests.json')},stdio:'ignore'});
after(()=>{child.kill();fs.rmSync(dir,{recursive:true,force:true});});
async function ready(){for(let i=0;i<90;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,65));}throw Error('Servidor indisponível');}
async function api(p,method='GET',body,token='',secret=''){
 const res=await fetch(base+'/api/team/'+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(secret?{'X-API-Key':secret}:{})},body:body?JSON.stringify(body):undefined});
 return {status:res.status,data:await res.json()};
}
test('licenças persistidas, vínculo cliente, segurança, revogação e conflito 409',async()=>{
 await ready();
 const admin=await api('bootstrap','POST',{nome:'Administrador ACR',login:'admin-lic',senha:'senha-teste-123'},'',key);
 assert.equal(admin.status,201);const token=admin.data.token;
 const client={id:'empresa01',nome:'Empresa Teste'};
 let ws=await api('workspace','PUT',{revision:0,clients:[client],orders:[],drafts:[],finance:[]},token);
 assert.equal(ws.status,200);
 let first=await api('licenses','GET',undefined,token);
 assert.equal(first.status,200);assert.equal(first.data.revision,0);assert.equal(first.data.items.length,0);
 assert.equal(first.data.companies[0].nome,'Empresa Teste');
 const item=license({empresaId:'empresa01',vencimento:'2026-10-25'});
 let saved=await api('licenses','PUT',{revision:0,items:[item]},token);
 assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
 assert.equal((await api('licenses','PUT',{revision:0,items:[item]},token)).status,409);
 assert.equal((await api('licenses','PUT',{revision:1,items:[{...item,total:2}]},token)).status,400);
 assert.equal((await api('licenses','PUT',{revision:1,items:[{...item,empresaId:'wrong-company'}]},token)).status,400);
 ws=await api('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[],finance:[]},token);
 assert.equal(ws.status,409);
 const tech=await api('users','POST',{nome:'Técnico Licenças',login:'tech-lic',perfil:'Técnico',senha:'senha12345'},token);
 assert.equal(tech.status,200);let techToken=(await api('login','POST',{login:'tech-lic',senha:'senha12345'})).data.token;
 assert.equal((await api('licenses','GET',undefined,techToken)).status,403);
 assert.equal((await api('licenses','PUT',{revision:1,items:[]},techToken)).status,403);
 assert.equal((await api('users/'+tech.data.user.id+'/permissions','PUT',{permissions:{licencas:true}},token)).status,200);
 assert.equal((await api('licenses','GET',undefined,techToken)).status,401);
 techToken=(await api('login','POST',{login:'tech-lic',senha:'senha12345'})).data.token;
 assert.equal((await api('licenses','GET',undefined,techToken)).status,200);
 assert.equal((await api('licenses','PUT',{revision:1,items:[item,{...item,id:'license-two',software:'ERP',status:'pago',dataPagamento:'2026-10-13'}]},techToken)).status,200);
 const disk=JSON.parse(fs.readFileSync(path.join(dir,'team.json'),'utf8'));
 assert.equal(disk.licenses.items.length,2);assert.equal(disk.workspace.clients[0].id,client.id);assert.equal(disk.licenses.revision,2);
});
