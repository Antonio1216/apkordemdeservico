'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'acr-ticket-'));
const port=28000+Math.floor(Math.random()*12000),base='http://127.0.0.1:'+port,key='admin-company-ticket-key-'+('x'.repeat(40));
const processServer=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{
 ...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,
 DATA_FILE:path.join(folder,'requests.json'),TEAM_DATA_FILE:path.join(folder,'team.json'),
 RESEND_API_KEY:'',PASSWORD_RESET_FROM_EMAIL:''
},stdio:'ignore'});
after(()=>{processServer.kill();fs.rmSync(folder,{recursive:true,force:true});});
async function ready(){for(let i=0;i<160;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('Servidor indisponível');}
async function api(endpoint,method='GET',body,auth='',portal='',adminKey=''){
 const result=await fetch(base+'/api/team/'+endpoint,{method,headers:{
  'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),
  ...(portal?{'X-Client-Portal':portal}:{}),...(adminKey?{'X-API-Key':adminKey}:{})
 },body:body===undefined?undefined:JSON.stringify(body)});
 const contentType=result.headers.get('content-type')||'';
 return {status:result.status,headers:result.headers,data:contentType.includes('application/json')?await result.json():await result.arrayBuffer()};
}
test('cliente pode abrir chamado somente para técnico da própria empresa; admin notificado; escopo é validado no servidor',async()=>{
 await ready();
 const adminResponse=await api('bootstrap','POST',{login:'admin',nome:'Administrador Principal',senha:'senha12345'},'','',key);
 assert.equal(adminResponse.status,201);const admin=adminResponse.data.token;
 const companies=[{id:'c1',nome:'Empresa Um'},{id:'c2',nome:'Empresa Dois'}];
 let r=await api('workspace','PUT',{revision:0,clients:companies,orders:[],drafts:[],finance:[]},admin);
 assert.equal(r.status,200);assert.equal(r.data.revision,1);
 const first=(await api('users','POST',{nome:'Tecnico Um',login:'techone',perfil:'Técnico',senha:'senha12345'},admin)).data.user;
 const second=(await api('users','POST',{nome:'Tecnico Dois',login:'techtwo',perfil:'Técnico',senha:'senha12345'},admin)).data.user;
 assert.equal((await api('users/'+first.id+'/company','PUT',{empresaId:'c1'},admin)).status,200);
 assert.equal((await api('users/'+second.id+'/company','PUT',{empresaId:'c2'},admin)).status,200);
 assert.equal((await api('users/'+first.id+'/company','PUT',{empresaId:'c-nao-existe'},admin)).status,400);
 assert.equal((await api('users/'+first.id+'/company','PUT',{empresaId:'c2'})).status,401);
 const t1=(await api('login','POST',{login:'techone',senha:'senha12345'})).data.token;
 const t2=(await api('login','POST',{login:'techtwo',senha:'senha12345'})).data.token;
 r=await api('workspace','GET',undefined,t1);assert.equal(r.status,200);assert.deepEqual(r.data.clients,[companies[0]]);
 r=await api('workspace','GET',undefined,t2);assert.deepEqual(r.data.clients,[companies[1]]);
 const portalA=(await api('customer-portals','POST',{empresaId:'c1'},admin)).data.link;
 assert.ok(portalA.includes('/client-portal#token='));
 const portalB=(await api('customer-portals','POST',{empresaId:'c2'},admin)).data.link;
 const tokenA=new URLSearchParams(portalA.split('#')[1]).get('token');
 const tokenB=new URLSearchParams(portalB.split('#')[1]).get('token');
 const a=(await api('customer/info','GET',undefined,'',tokenA)).data;
 assert.deepEqual(a.tecnicos,[{id:first.id,nome:'Tecnico Um'}]);
 const b=(await api('customer/info','GET',undefined,'',tokenB)).data;
 assert.deepEqual(b.tecnicos,[{id:second.id,nome:'Tecnico Dois'}]);
 const evidence=Buffer.from([0xff,0xd8,0xff,...new Array(50).fill(5)]).toString('base64');
 const payload={tipo:'Relógio de ponto',equipamento:'REP entrada',localEquipamento:'Portaria setor B',
 descricao:'Relógio apresenta mensagem de erro e não registra o ponto',tecnicoId:first.id,
 localizacao:{lat:-3.7,lon:-38.5,accuracy:20},evidencias:[{name:'evidencia.jpg',mime:'image/jpeg',data:evidence}]};
 r=await api('customer/tickets','POST',{...payload,tecnicoId:second.id},'',tokenA);assert.equal(r.status,400);
 r=await api('customer/tickets','POST',payload,'',tokenA);assert.equal(r.status,201);
 const ticket=r.data.ticket;
 assert.equal(ticket.empresaId,'c1');assert.equal(ticket.tecnicoId,first.id);
 assert.equal(ticket.evidencias.length,1);
 assert.equal((await api('customer/tickets','GET',undefined,'',tokenB)).data.tickets.length,0);
 assert.equal((await api('customer/tickets/'+ticket.id+'/evidence/'+ticket.evidencias[0].id,'GET',undefined,'',tokenB)).status,404);
 assert.equal((await api('tickets','GET',undefined,t2)).data.tickets.length,0);
 r=await api('tickets','GET',undefined,t1);assert.equal(r.data.tickets.length,1);assert.deepEqual(r.data.novos,[ticket.id]);
 assert.equal((await api('tickets','GET',undefined,admin)).data.novos[0],ticket.id);
 assert.equal((await api('tickets/'+ticket.id+'/status','POST',{status:'Concluído'},t2)).status,403);
 assert.equal((await api('tickets/'+ticket.id+'/status','POST',{status:'Em atendimento'},t1)).status,200);
 assert.equal((await api('tickets','GET',undefined,admin)).data.tickets[0].status,'Em atendimento');
 const download=await api('tickets/'+ticket.id+'/evidence-data/'+ticket.evidencias[0].id,'GET',undefined,t1);
 assert.equal(download.status,200);assert.equal(download.data.data,evidence);
 assert.equal((await api('tickets','GET',undefined,t1)).data.novos.length,0);
 assert.equal((await api('tickets/seen','POST',{ids:[ticket.id]},t1)).status,200);
 // Prevent replacing another company's records through the existing workspace sync route.
 assert.equal((await api('workspace','PUT',{revision:1,clients:companies,orders:[],drafts:[]},t1)).status,403);
 const s=(await api('workspace','GET',undefined,t1)).data;
 assert.equal((await api('workspace','PUT',{revision:s.revision,clients:s.clients,orders:[],drafts:[]},t1)).status,200);
 assert.deepEqual((await api('workspace','GET',undefined,admin)).data.clients,companies);
 // Link rotation invalidates previously shared credentials.
 const newLink=(await api('customer-portals','POST',{empresaId:'c1'},admin)).data.link;
 assert.notEqual(newLink,portalA);
 assert.equal((await api('customer/info','GET',undefined,'',tokenA)).status,401);
 const database=JSON.parse(fs.readFileSync(path.join(folder,'team.json'),'utf8'));
 assert.ok(!JSON.stringify(database).includes(tokenA));
 assert.ok(database.tickets[0].evidencias[0].id);
});
