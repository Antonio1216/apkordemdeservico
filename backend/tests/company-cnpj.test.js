'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const vm=require('node:vm');
const Cnpj=require('../cnpj-lookup');
const good='19131243000197',second='11222333000181';

test('CNPJ é validado e resposta pública é reduzida aos dados da empresa, sem sócios',async()=>{
 assert.equal(Cnpj.normalizeCnpj('19.131.243/0001-97'),good);
 assert.equal(Cnpj.validCnpj(good),true);
 assert.equal(Cnpj.validCnpj('19131243000198'),false);
 assert.equal(Cnpj.validCnpj('00000000000000'),false);
 const fake=async()=>new Response(JSON.stringify({
  cnpj:good,razao_social:'EMPRESA EXEMPLO SA',nome_fantasia:'Exemplo',
  logradouro:'Avenida Testes',numero:'123',municipio:'Campinas',uf:'SP',
  cep:'13000000',descricao_situacao_cadastral:'ATIVA',
  qsa:[{cpf_representante_legal:'12345678901',nome_socio:'Dados de terceiros'}]
 }),{status:200,headers:{'Content-Type':'application/json'}});
 const result=await Cnpj.lookupCnpj(good,fake);
 assert.equal(result.razaoSocial,'EMPRESA EXEMPLO SA');
 assert.equal(result.nomeFantasia,'Exemplo');
 assert.equal(result.cidade,'Campinas');
 assert.equal(result.situacaoCadastral,'ATIVA');
 assert.ok(!JSON.stringify(result).includes('12345678901'));
 assert.ok(!JSON.stringify(result).includes('qsa'));
 await assert.rejects(()=>Cnpj.lookupCnpj(good,async()=>new Response('{}',{status:429})),e=>e.status===503);
 await assert.rejects(()=>Cnpj.lookupCnpj('00000000000000',fake),e=>e.status===400);
});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acr-cnpj-'));
const port=26000+Math.floor(Math.random()*10000),base='http://127.0.0.1:'+port,key='company-cnpj-unit-key-'+('k'.repeat(40));
const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{
 ...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,
 DATA_FILE:path.join(dir,'requests.json'),TEAM_DATA_FILE:path.join(dir,'team.json')
},stdio:'ignore'});
after(()=>{proc.kill();fs.rmSync(dir,{recursive:true,force:true});});
async function ready(){for(let n=0;n<150;n++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('Servidor indisponível');}
async function api(p,method='GET',data,token='',adminKey=''){
 const r=await fetch(base+'/api/team/'+p,{method,headers:{'Content-Type':'application/json',
  ...(token?{Authorization:'Bearer '+token}:{}),...(adminKey?{'X-API-Key':adminKey}:{})},
  body:data===undefined?undefined:JSON.stringify(data)});
 return {status:r.status,data:await r.json()};
}
test('painel lista e edita CNPJ com preservação de vínculo, ID, ordens e metadados',async()=>{
 await ready();
 const html=await (await fetch(base+'/admin-chamados')).text();
 assert.ok(html.includes('id="company-cnpj"'));
 assert.ok(html.includes('id="company-list"'));
 assert.ok(html.includes('id="lookup-outsourcing"'));
 const script=await (await fetch(base+'/admin-chamados.js')).text();
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.ok(script.includes('function renderCompanies()'));
 assert.ok(script.includes("request('companies/cnpj/'"));
 assert.ok(!script.includes('localStorage'));
 const admin=(await api('bootstrap','POST',{nome:'Admin de teste',login:'admin',senha:'SenhaLonga0123'},'',key)).data.token;
 assert.equal((await api('companies/cnpj/'+good)).status,401);
 assert.equal((await api('companies','GET')).status,401);
 const invalid=await api('companies/cnpj/00000000000000','GET',undefined,admin);
 assert.equal(invalid.status,400);
 const created=await api('companies','POST',{nome:'Empresa Antiga',cnpj:'19.131.243/0001-97',
  razaoSocial:'RAZÃO SOCIAL ORIGINAL',cidade:'Recife',uf:'PE',logradouro:'Rua A',cep:'50000000'},admin);
 assert.equal(created.status,201);
 const id=created.data.company.id;
 assert.equal(created.data.company.cnpj,good);
 assert.equal((await api('companies','POST',{nome:'Duplicada',cnpj:good},admin)).status,409);
 const outs=(await api('companies','POST',{nome:'Terceirizada Pai'},admin)).data.company;
 const link=await api('companies/link','POST',{terceirizadaId:outs.id,clienteFinalId:id},admin);
 assert.equal(link.status,200);
 const user=(await api('users','POST',{nome:'Técnico de Apoio',login:'tecnico',senha:'SenhaTeste123',perfil:'Técnico'},admin)).data.user;
 assert.equal((await api('users/'+user.id+'/company','PUT',{empresaId:id},admin)).status,200);
 const technicianToken=(await api('login','POST',{login:'tecnico',senha:'SenhaTeste123'})).data.token;
 assert.equal((await api('companies/'+id,'PATCH',{nome:'Invadido'},technicianToken)).status,403);
 assert.equal((await api('companies/cnpj/'+good,'GET',undefined,technicianToken)).status,403);
 const edited=await api('companies/'+id,'PATCH',{nome:'Empresa Atualizada',cnpj:good,
  razaoSocial:'NOVA RAZÃO SOCIAL',cidade:'São Paulo',uf:'SP',logradouro:'Rua Nova',cep:'01001000',
  telefone:'1133334444'},admin);
 assert.equal(edited.status,200);
 assert.equal(edited.data.company.id,id);
 assert.equal(edited.data.company.terceirizadaId,outs.id);
 assert.equal(edited.data.company.cidade,'São Paulo');
 assert.equal(edited.data.company.razaoSocial,'NOVA RAZÃO SOCIAL');
 assert.equal((await api('companies/'+id,'PATCH',{nome:'Empresa Atualizada',cnpj:'123'},admin)).status,400);
 assert.equal((await api('companies/'+id,'PATCH',{nome:'Terceirizada Pai'},admin)).status,409);
 let companies=(await api('companies','GET',undefined,admin)).data.companies;
 assert.equal(companies.length,2);
 assert.equal(companies.find(c=>c.id===id).nome,'Empresa Atualizada');
 assert.equal(companies.find(c=>c.id===id).terceirizadaId,outs.id);
 const workspace=(await api('workspace','GET',undefined,admin)).data;
 assert.equal(workspace.clients.find(c=>c.id===id).nome,'Empresa Atualizada');
 const saved=JSON.parse(fs.readFileSync(path.join(dir,'team.json'),'utf8'));
 assert.equal(saved.companyDetails[id].cnpj,good);
 assert.equal(saved.companyLinks[id],outs.id);
 assert.equal(saved.accounts.find(u=>u.id===user.id).empresaId,id);
});
test('cadastro conjunto registra CNPJ de terceirizada e cliente final sem duplicar',async()=>{
 await ready();
 const admin=(await api('login','POST',{login:'admin',senha:'SenhaLonga0123'})).data.token;
 const created=await api('companies/link','POST',{
  terceirizadaNome:'Terceirizada Nova',terceirizadaCnpj:second,
  terceirizadaDetalhes:{cnpj:second,razaoSocial:'TERCEIRIZADA TESTE',cidade:'Curitiba',uf:'PR'},
  clienteFinalNome:'Cliente Novo',
  clienteFinalDetalhes:{razaoSocial:'CLIENTE FINAL LTDA',cidade:'Fortaleza',uf:'CE'}
 },admin);
 assert.equal(created.status,200);
 assert.equal(created.data.terceirizada.cnpj,second);
 assert.equal(created.data.terceirizada.cidade,'Curitiba');
 assert.equal(created.data.clienteFinal.cidade,'Fortaleza');
 assert.equal((await api('companies/link','POST',{
  terceirizadaNome:'Outra Terceirizada',terceirizadaCnpj:second,
  clienteFinalNome:'Cliente Terceiro'
 },admin)).status,409);
 const persisted=JSON.parse(fs.readFileSync(path.join(dir,'team.json'),'utf8'));
 assert.equal(persisted.workspace.clients.length,4);
 assert.equal(persisted.companyDetails[created.data.clienteFinal.id].cidade,'Fortaleza');
});
