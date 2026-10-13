'use strict';
// Cálculos de viagem usados igualmente no aplicativo e na validação do servidor.
// Todos os valores são em BRL. A tarifa por km e o abastecimento são separados
// para evitar cobrança duplicada quando o combustível já integra a tarifa.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ACRTravel=api;
})(typeof window!=='undefined'?window:null,function(){
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const decimal=(v,label,max=1e8)=>{
    if(v===''||v===null||v===undefined) return 0;
    const x=typeof v==='string'?Number(v.replace(',','.')):v;
    if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>max)throw Error(label+' inválido.');
    return x;
  };
  const clean=(v,label,max=160)=>{
    const x=String(v??'').trim();
    if(x.length>max)throw Error(label+' excede o limite de caracteres.');
    return x;
  };
  function calculateTravel(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Dados de viagem inválidos.');
    const kmInicial=decimal(input.kmInicial,'Km inicial',99999999);
    const kmAtual=decimal(input.kmAtual,'Km atual',99999999);
    if(kmAtual<kmInicial)throw Error('O km atual não pode ser menor que o km inicial.');
    const kmRodados=round(kmAtual-kmInicial);
    const tarifaKm=decimal(input.tarifaKm,'Valor por km',10000);
    const abastecimento=decimal(input.abastecimento,'Valor do abastecimento');
    const hospedagem=decimal(input.hospedagem,'Valor da hospedagem');
    const alimentacao=decimal(input.alimentacao,'Valor da alimentação');
    const tanqueCompleto=Boolean(input.tanqueCompleto);
    const incluirAbastecimento=input.incluirAbastecimento!==false;
    const custoKm=round(kmRodados*tarifaKm);
    const total=round(custoKm+(incluirAbastecimento?abastecimento:0)+hospedagem+alimentacao);
    if(total>100000000)throw Error('Total da viagem excede o limite permitido.');
    return {kmInicial,kmAtual,kmRodados,tarifaKm,custoKm,abastecimento,tanqueCompleto,
      incluirAbastecimento,hospedagem,alimentacao,total,
      veiculo:clean(input.veiculo,'Veículo',120),
      observacoes:clean(input.observacoes,'Observações',1000)};
  }
  return {calculateTravel};
});
