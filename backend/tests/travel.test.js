'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {calculateTravel}=require('../travel');
test('quilometragem, taxa, combustível, hospedagem e alimentação',()=>{
 const t=calculateTravel({kmInicial:12500,kmAtual:12620,tarifaKm:1.25,abastecimento:180,tanqueCompleto:true,incluirAbastecimento:true,hospedagem:220,alimentacao:75,veiculo:'Carro de serviço'});
 assert.equal(t.kmRodados,120);assert.equal(t.custoKm,150);assert.equal(t.total,625);assert.equal(t.tanqueCompleto,true);
 const excluded=calculateTravel({...t,incluirAbastecimento:false});assert.equal(excluded.total,445);
 assert.equal(calculateTravel({...t,kmInicial:12620,kmAtual:12620}).kmRodados,0);
 assert.throws(()=>calculateTravel({...t,kmInicial:12800}),/km atual/);
 assert.throws(()=>calculateTravel({...t,alimentacao:-30}),/alimentação/);
 assert.throws(()=>calculateTravel({...t,abastecimento:'not a number'}),/abastecimento/);
});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acr-trip-')),port=30000+Math.floor(Math.random()*18000),base='http://127.0.0.1:'+port,key='travels-test-admin-'+('p'.repeat(38));
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,TEAM_DATA_FILE:path.join(dir,'team.json'),DATA_FILE:path.join(dir,'requests.json')},stdio:'ignore'});
after(()=>{child.kill();fs.rmSync(dir,{recursive:true,force:true});});
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,70));}throw Error('Backend unavailable');}
async function api(p,method='GET',body,token='',keyHeader=''){const resp=await fetch(base+'/api/team/'+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(keyHeader?{'X-API-Key':keyHeader}:{})},body:body?JSON.stringify(body):undefined});return {status:resp.status,data:await resp.json()};}
test('despesas de viagem persistidas e protegidas por permissão financeira',async()=>{
 await ready();
 const bootstrap=await api('bootstrap','POST',{nome:'Admin ACR',login:'admin-trip',senha:'senha-segura'},'',key);
 assert.equal(bootstrap.status,201);const admin=bootstrap.data.token;
 const user=await api('users','POST',{nome:'Técnico sem Financeiro',login:'tech-trip',perfil:'Técnico',senha:'teste1234'},admin);
 assert.equal(user.status,200);
 let tech=(await api('login','POST',{login:'tech-trip',senha:'teste1234'})).data.token;
 let state=await api('workspace');assert.equal(state.status,401);
 const detail=calculateTravel({kmInicial:4591,kmAtual:4673.2,tarifaKm:1.2,abastecimento:90,tanqueCompleto:false,incluirAbastecimento:false,hospedagem:150,alimentacao:40,veiculo:'Veículo 01'});
 const expense={id:'travel01',tipo:'despesa',categoria:'viagem',data:'2026-10-13',osNumero:'OS-2026-TESTE',descricao:'Despesas de viagem',forma:'Despesas de viagem',valor:detail.total,viagem:detail};
 state=await api('workspace','PUT',{revision:0,clients:[],orders:[],drafts:[],finance:[expense]},admin);
 assert.equal(state.status,200);assert.equal(state.data.finance[0].viagem.kmRodados,82.2);
 assert.equal((await api('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[],finance:[{...expense,valor:1}]},admin)).status,400);
 assert.equal((await api('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[],finance:[{...expense,viagem:{...detail,kmAtual:10}}]},admin)).status,400);
 assert.equal((await api('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[],finance:[{...expense,data:'13-10-2026'}]},admin)).status,400);
 assert.equal((await api('workspace','GET',null,tech)).data.finance,undefined);
 assert.equal((await api('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[],finance:[expense]},tech)).status,403);
 let allowed=await api('users/'+user.data.user.id+'/permissions','PUT',{permissions:{financeiro:true}},admin);
 assert.equal(allowed.status,200);
 assert.equal((await api('workspace','GET',null,tech)).status,401);
 tech=(await api('login','POST',{login:'tech-trip',senha:'teste1234'})).data.token;
 assert.equal((await api('workspace','GET',null,tech)).data.finance.length,1);
 // A conta de técnico com financeiro pode lançar viagem sem apagar as existentes.
 state=await api('workspace','PUT',{revision:1,clients:[],orders:[],drafts:[],finance:[expense,{...expense,id:'travel02',osNumero:'OS-2'}]},tech);
 assert.equal(state.status,200);assert.equal(state.data.finance.length,2);
 const stored=JSON.parse(fs.readFileSync(path.join(dir,'team.json'),'utf8'));
 assert.equal(stored.workspace.finance[0].viagem.tanqueCompleto,false);
 assert.equal(stored.workspace.finance[0].viagem.incluirAbastecimento,false);
 assert.equal(stored.workspace.finance[0].valor,detail.total);
});
