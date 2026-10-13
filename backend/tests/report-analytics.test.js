'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {equipmentReport,catalogReport,travelReport}=require('../report-analytics');
test('equipamentos agrupados por empresa, filtros e serial, IP, MAC mantidos',()=>{
  const companies=[{id:'c1',nome:'Indústria A'},{id:'c2',nome:'Empresa B'}];
  const equipment=[
   {id:'e1',empresaId:'c1',nome:'Servidor principal',tipo:'Servidor',serie:'SN-321',ip:'10.0.0.1',mac:'AA:BB:CC:DD:EE:FF',status:'Ativo'},
   {id:'e2',empresaId:'c2',nome:'Câmera acesso',tipo:'CFTV personalizado',serie:'CF-9',ip:'10.1.1.1',status:'Em manutenção'},
   {id:'e3',empresaId:'c1',nome:'Nobreak TI',tipo:'Nobreak',serie:'NB-2',status:'Ativo'}
  ];
  let out=equipmentReport(equipment,companies);
  assert.equal(out.count,3);assert.equal(out.companies,2);assert.equal(out.groups.find(g=>g.id==='c1').items.length,2);
  out=equipmentReport(equipment,companies,{companyId:'c1',search:'SN-321'});
  assert.equal(out.count,1);assert.equal(out.items[0].ip,'10.0.0.1');
  assert.equal(out.items[0].mac,'AA:BB:CC:DD:EE:FF');
  out=equipmentReport(equipment,companies,{type:'CFTV personalizado'});
  assert.equal(out.count,1);assert.equal(out.items[0].empresa,'Empresa B');
  assert.equal(equipmentReport(equipment,companies,{status:'Desativado'}).count,0);
});
test('serviços e produtos filtrados por empresa, com totais',()=>{
  const c=[{id:'c1',nome:'Empresa A'}];
  const report=catalogReport(
    [{id:'s1',empresaId:'c1',nome:'Manutenção',valor:120}],
    [{id:'p1',empresaId:'c1',nome:'Switch',valor:300,quantidade:4},{id:'p2',empresaId:'',nome:'Cabo',valor:9,quantidade:10}],c,{companyId:'c1'});
  assert.equal(report.count,2);assert.equal(report.products,1);assert.equal(report.services,1);
  assert.deepEqual(report.items.find(x=>x.nome==='Switch').quantidade,4);
});
test('despesas viagens agrupadas por OS sem contagem dupla do abastecimento',()=>{
  const trips=[
    {id:'t1',tipo:'despesa',categoria:'viagem',data:'2026-10-10',osNumero:'OS-001',valor:260,viagem:{kmRodados:100,custoKm:110,abastecimento:100,incluirAbastecimento:false,hospedagem:80,alimentacao:70,tanqueCompleto:true}},
    {id:'t2',tipo:'despesa',categoria:'viagem',data:'2026-10-11',osNumero:'OS-001',valor:250,viagem:{kmRodados:25,custoKm:50,abastecimento:100,incluirAbastecimento:true,hospedagem:60,alimentacao:40,tanqueCompleto:false}},
    {id:'t3',tipo:'receita',categoria:'outro',data:'2026-10-11',osNumero:'OS-001',valor:500}
  ];
  const all=travelReport(trips);assert.equal(all.total.count,2);assert.equal(all.total.valor,510);
  assert.equal(all.total.abastecimento,200);assert.equal(all.total.abastecimentoSomado,100);
  assert.equal(all.total.km,125);assert.equal(all.groups[0].valor,510);
  const only=travelReport(trips,{order:'001',from:'2026-10-11',to:'2026-10-11'});
  assert.equal(only.total.count,1);assert.equal(only.items[0].viagem.tanqueCompleto,false);
});
