'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'acr-admin-portal-'));
const port=28000+Math.floor(Math.random()*12000);
const base='http://127.0.0.1:'+port;
const key='test-admin-key-'+('x'.repeat(50));
const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{
 ...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,
 DATA_FILE:path.join(folder,'requests.json'),TEAM_DATA_FILE:path.join(folder,'team.json')
},stdio:'ignore'});
after(()=>{proc.kill();fs.rmSync(folder,{recursive:true,force:true});});
async function ready(){for(let i=0;i<120;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('Servidor de teste indisponível.');}
async function api(p,method='GET',data,bearer='',apiKey=''){
 const r=await fetch(base+'/api/team/'+p,{method,headers:{
  'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{}),
  ...(apiKey?{'X-API-Key':apiKey}:{})
 },body:data===undefined?undefined:JSON.stringify(data)});
 return {status:r.status,data:await r.json()};
}
test('Administração via navegador: isolamento por perfil, cadastro atômico, delegação e portal de cliente',async()=>{
 await ready();
 const page=await fetch(base+'/admin-chamados');
 assert.equal(page.status,200);
 assert.ok((await page.text()).includes('Entrar como administrador'));
 const script=await fetch(base+'/admin-chamados.js');
 assert.equal(script.status,200);
 const code=await script.text();
 assert.ok(code.includes("request('customer-portals','POST'"));
 assert.ok(!code.includes('localStorage'));
 assert.equal((await api('companies')).status,401);
 const registered=await api('bootstrap','POST',{nome:'Admin de Teste',login:'admin',senha:'SenhaAdmin123'},'',key);
 assert.equal(registered.status,201);const admin=registered.data.token;
 const a=await api('companies','POST',{nome:'Primeira Empresa'},admin);
 assert.equal(a.status,201);const first=a.data.company;
 assert.ok(/^[0-9a-f-]{36}$/i.test(first.id));
 assert.equal((await api('companies','POST',{nome:'primeira empresa'},admin)).status,409);
 const techReg=await api('users','POST',{nome:'Tecnico do Cliente',login:'tecnico',senha:'SenhaTecnico123',email:'tech@example.com',perfil:'Técnico'},admin);
 assert.equal(techReg.status,200);const technician=techReg.data.user;
 const login=await api('login','POST',{login:'tecnico',senha:'SenhaTecnico123'});
 assert.equal(login.status,200);
 const tech=login.data.token;
 assert.equal((await api('companies')).status,401);
 assert.equal((await api('companies','GET',undefined,tech)).status,403);
 assert.equal((await api('companies','POST',{nome:'Empresa Invasora'},tech)).status,403);
 const next=await api('companies','POST',{nome:'Segunda Empresa'},admin);
 assert.equal(next.status,201);const second=next.data.company;
 assert.equal((await api('companies','GET',undefined,admin)).data.companies.length,2);
 const assignment=await api('users/'+technician.id+'/company','PUT',{empresaId:first.id},admin);
 assert.equal(assignment.status,200);assert.equal(assignment.data.user.empresaId,first.id);
 assert.equal((await api('users/'+technician.id+'/company','PUT',{empresaId:second.id},tech)).status,401); // assignment revoked old session
 assert.equal((await api('login','POST',{login:'tecnico',senha:'SenhaTecnico123'})).status,200);
 const portal=await api('customer-portals','POST',{empresaId:first.id},admin);
 assert.equal(portal.status,200);
 assert.ok(portal.data.link.includes('/client-portal#token='));
 assert.ok(!JSON.stringify((await api('companies','GET',undefined,admin)).data).includes('token='));
 const workspace=await api('workspace','GET',undefined,admin);
 assert.deepEqual(workspace.data.clients.map(x=>x.id),[first.id,second.id]);
 assert.equal(workspace.data.revision,2);
 const saved=JSON.parse(fs.readFileSync(path.join(folder,'team.json'),'utf8'));
 assert.ok(!JSON.stringify(saved).includes(portal.data.link.split('token=')[1]));
});
