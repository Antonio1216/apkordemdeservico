'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const vm=require('node:vm');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'acr-linked-clients-'));
const port=29000+Math.floor(Math.random()*10000),base='http://127.0.0.1:'+port;
const key='backend-company-link-test-key-'+('z'.repeat(40));
const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{
 ...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,
 DATA_FILE:path.join(folder,'requests.json'),TEAM_DATA_FILE:path.join(folder,'team.json')
},stdio:'ignore'});
after(()=>{proc.kill();fs.rmSync(folder,{recursive:true,force:true});});
async function ready(){for(let i=0;i<160;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('Servidor indisponível');}
async function api(route,method='GET',data,token='',portal='',adminKey=''){
 const r=await fetch(base+'/api/team/'+route,{method,headers:{'Content-Type':'application/json',
   ...(token?{Authorization:'Bearer '+token}:{}),...(portal?{'X-Client-Portal':portal}:{}),
   ...(adminKey?{'X-API-Key':adminKey}:{})
 },body:data===undefined?undefined:JSON.stringify(data)});
 return {status:r.status,data:await r.json()};
}
test('cadastrar terceirizada e cliente final juntos, sem misturar chamados e empresas',async()=>{
 await ready();
 const page=await fetch(base+'/admin-chamados');
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes('id="company-link-form"'));
 assert.ok(html.includes('Cadastrar terceirizada e cliente final juntos'));
 const code=await (await fetch(base+'/admin-chamados.js')).text();
 assert.ok(code.includes("request('companies/link','POST'"));
 const admin=(await api('bootstrap','POST',{nome:'Gestor Teste',login:'gestor',senha:'Senha123456789'},'','',key)).data.token;
 const noPermission=await api('companies/link','POST',{terceirizadaNome:'Intermediária Ltda',clienteFinalNome:'Escola Final'},'');
 assert.equal(noPermission.status,401);
 const created=await api('companies/link','POST',{terceirizadaNome:'Intermediária Ltda',clienteFinalNome:'Escola Final'},admin);
 assert.equal(created.status,200);
 const outs=created.data.terceirizada,final=created.data.clienteFinal;
 assert.ok(outs.id&&final.id&&outs.id!==final.id);
 assert.equal(final.terceirizadaId,outs.id);
 assert.equal(outs.tipoEmpresa,'terceirizada');
 assert.equal(final.tipoEmpresa,'cliente-final');
 let list=await api('companies','GET',undefined,admin);
 assert.equal(list.status,200);
 assert.equal(list.data.companies.length,2);
 assert.equal(list.data.companies.find(c=>c.id===final.id).terceirizadaNome,'Intermediária Ltda');
 assert.equal((await api('companies/link','POST',{terceirizadaNome:'intermediária ltda',clienteFinalNome:'Outra Final'},admin)).status,409);
 assert.equal((await api('companies/link','POST',{terceirizadaId:outs.id,clienteFinalNome:'Intermediária Ltda'},admin)).status,409);
 assert.equal((await api('companies/link','POST',{terceirizadaId:outs.id,clienteFinalId:outs.id},admin)).status,400);
 const old=(await api('companies','POST',{nome:'Cliente Final Já Existente'},admin)).data.company;
 const existing=await api('companies/link','POST',{terceirizadaId:outs.id,clienteFinalId:old.id},admin);
 assert.equal(existing.status,200);
 assert.equal(existing.data.clienteFinal.id,old.id);
 list=await api('companies','GET',undefined,admin);
 assert.equal(list.data.companies.length,3); // no duplication
 assert.equal(list.data.companies.find(c=>c.id===old.id).terceirizadaId,outs.id);
 // A parent terceirizada cannot open a client portal for its children.
 assert.equal((await api('customer-portals','POST',{empresaId:outs.id},admin)).status,400);
 const link=(await api('customer-portals','POST',{empresaId:final.id},admin));
 assert.equal(link.status,200);
 const secret=new URLSearchParams(link.data.link.split('#')[1]).get('token');
 const info=await api('customer/info','GET',undefined,'',secret);
 assert.equal(info.status,200);
 assert.equal(info.data.empresa,'Escola Final');
 assert.equal(info.data.terceirizada,'Intermediária Ltda');
 // Technician assigned to the final customer, not automatically to every client of outsourced company.
 const t=(await api('users','POST',{nome:'Técnico Soluções',login:'tecnico',senha:'SenhaTecnico123',perfil:'Técnico'},admin)).data.user;
 assert.equal((await api('users/'+t.id+'/company','PUT',{empresaId:final.id},admin)).status,200);
 assert.deepEqual((await api('customer/info','GET',undefined,'',secret)).data.tecnicos,[{id:t.id,nome:'Técnico Soluções'}]);
 const oldLink=(await api('customer-portals','POST',{empresaId:old.id},admin)).data.link;
 const other=new URLSearchParams(oldLink.split('#')[1]).get('token');
 assert.deepEqual((await api('customer/info','GET',undefined,'',other)).data.tecnicos,[]);
 // Deletion using an old APK must not silently break the subcontractor relationship.
 const ws=(await api('workspace','GET',undefined,admin)).data;
 assert.equal(ws.clients.length,3);
 assert.equal((await api('workspace','PUT',{revision:ws.revision,clients:[{id:final.id,nome:'Escola Final'}],orders:[],drafts:[],finance:[]},admin)).status,409);
 const saved=JSON.parse(fs.readFileSync(path.join(folder,'team.json'),'utf8'));
 assert.equal(saved.companyLinks[final.id],outs.id);
 assert.equal(saved.workspace.clients.length,3);
 assert.ok(!JSON.stringify(saved).includes(secret)); // client portal token hashed, not plaintext
});

test('scripts das páginas administrativas e do portal de cliente possuem JavaScript válido',()=>{
 for(const name of ['admin-chamados.js','client-portal.js']){
  const file=fs.readFileSync(path.join(__dirname,'..','public',name),'utf8');
  assert.doesNotThrow(()=>new vm.Script(file,{filename:name}));
 }
});
