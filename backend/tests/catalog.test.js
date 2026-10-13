'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acr-catalog-')),port=28000+Math.floor(Math.random()*20000),base='http://127.0.0.1:'+port,key='catalog-test-key-'+'z'.repeat(45);
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,TEAM_DATA_FILE:path.join(dir,'team.json'),DATA_FILE:path.join(dir,'requests.json')},stdio:'ignore'});
after(()=>{child.kill();fs.rmSync(dir,{recursive:true,force:true});});
async function request(p,method='GET',body,token='',secret=''){const resp=await fetch(base+'/api/team/'+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(secret?{'X-API-Key':secret}:{})},body:body?JSON.stringify(body):undefined});return {status:resp.status,data:await resp.json()};}
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,60));}throw Error('Servidor indisponível');}
test('catálogo corporativo: tipos livres, equipamentos vinculados à empresa, permissões e revisões',async()=>{
 await ready();const admin=await request('bootstrap','POST',{nome:'Admin ACR',login:'admin-acr',senha:'senha1234'},'',key);
 assert.equal(admin.status,201);const a=admin.data.token;
 const client={id:'empresa-01',nome:'Cliente Empresa Exemplo'};
 let workspace=await request('workspace','PUT',{revision:0,clients:[client],orders:[],drafts:[],finance:[]},a);
 assert.equal(workspace.status,200);
 let v=await request('catalog','GET',null,a);assert.equal(v.status,200);assert.equal(v.data.revision,0);assert.equal(v.data.companies[0].nome,client.nome);
 const payload={revision:0,services:[{id:'s1',nome:'Instalação elétrica',descricao:'Visita',codigo:'SV-1',unidade:'hora',valor:120,empresaId:''}],products:[{id:'p1',nome:'Roteador',descricao:'Wi-Fi',codigo:'PR-1',unidade:'un',valor:200,quantidade:2,empresaId:'empresa-01'}],equipments:[{id:'e1',nome:'Servidor principal',tipo:'Servidor de aplicações personalizado',empresaId:'empresa-01',serie:'SN0099',ip:'192.168.1.10',mac:'AA:BB:CC:DD:EE:FF',fabricante:'ACME',modelo:'R2',local:'Rack',status:'Ativo',observacoes:''}]};
 v=await request('catalog','PUT',payload,a);assert.equal(v.status,200);assert.equal(v.data.revision,1);
 assert.equal((await request('catalog','PUT',payload,a)).status,409);
 assert.equal((await request('catalog','PUT',{...payload,revision:1,equipments:[{...payload.equipments[0],empresaId:'inexistente'}]},a)).status,400);
 assert.equal((await request('catalog','PUT',{...payload,revision:1,equipments:[{...payload.equipments[0],mac:'ERRADO'}]},a)).status,400);
 assert.equal((await request('catalog','PUT',{...payload,revision:1,equipments:[payload.equipments[0],{...payload.equipments[0],id:'e2'}]},a)).status,400);
 workspace=await request('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[],finance:[]},a);assert.equal(workspace.status,409);
 const user=await request('users','POST',{nome:'Técnico Sem Catálogo',login:'tech-catalog',perfil:'Técnico',senha:'123456'},a);assert.equal(user.status,200);
 const tech=(await request('login','POST',{login:'tech-catalog',senha:'123456'})).data.token;
 assert.equal((await request('catalog','GET',null,tech)).status,403);
 assert.equal((await request('catalog','PUT',{...payload,revision:1},tech)).status,403);
 const allow=await request('users/'+user.data.user.id+'/permissions','PUT',{permissions:{catalogo:true}},a);assert.equal(allow.status,200);
 assert.equal((await request('catalog','GET',null,tech)).status,401);
 const relog=(await request('login','POST',{login:'tech-catalog',senha:'123456'})).data.token;
 assert.equal((await request('catalog','GET',null,relog)).status,200);
 assert.equal((await request('catalog','PUT',{...payload,revision:1},relog)).status,200);
 const disk=JSON.parse(fs.readFileSync(path.join(dir,'team.json'),'utf8'));assert.equal(disk.catalog.equipments[0].serie,'SN0099');assert.equal(disk.workspace.clients[0].id,'empresa-01');
});
