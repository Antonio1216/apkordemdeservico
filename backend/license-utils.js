'use strict';
/* Shared calculation/validation model — never store software activation secrets here. */
(function(root,make){const api=make();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ACRLicenses=api;})(typeof window!=='undefined'?window:null,function(){
  const round=v=>Math.round((v+Number.EPSILON)*100)/100;
  const isDay=v=>{
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
    const d=new Date(v+'T00:00:00Z');
    return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
  };
  const days=(today,due)=>Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(due+'T00:00:00Z'))/86400000);
  const todayUTC=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(x=>x.type===t).value;return get('year')+'-'+get('month')+'-'+get('day');};
  function evaluate(record,today=todayUTC()){
    if(!isDay(today))throw Error('Data atual inválida.');
    if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Dados da licença inválidos.');
    const quantity=Number(record.quantidade),price=Number(record.valorUnitario);
    if(!Number.isInteger(quantity)||quantity<1||quantity>100000)throw Error('Quantidade de unidades deve ser de 1 a 100.000.');
    if(!Number.isFinite(price)||price<0||price>100000000||round(price)!==price)throw Error('Valor por unidade inválido (máximo duas casas decimais).');
    const total=round(quantity*price);
    if(total>100000000)throw Error('Valor total da licença excede o limite.');
    if(!isDay(record.vencimento))throw Error('Informe a data de vencimento válida.');
    const paid=record.status==='pago';
    if(!['pago','pendente','atrasado'].includes(record.status))throw Error('Situação de pagamento inválida.');
    const overdue=!paid&&days(today,record.vencimento)>0;
    if(record.status==='atrasado'&&!overdue)throw Error('Uma licença só pode estar atrasada depois do vencimento.');
    const daysLate=overdue?days(today,record.vencimento):0;
    return {total,daysLate,effectiveStatus:paid?'pago':overdue?'atrasado':'pendente',paid};
  }
  function validate(record,today=todayUTC()){
    if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Registro inválido.');
    const strings={id:100,software:180,tipoLicenca:120,unidade:80,descricao:2000,empresaId:100,fornecedor:160};
    for(const [key,max] of Object.entries(strings)){
      if(typeof record[key]!=='string'||record[key].length>max)throw Error('Campo inválido: '+key+'.');
    }
    if(!record.id||!record.software.trim()||!record.tipoLicenca.trim()||!record.unidade.trim())throw Error('Informe software, tipo de licença e unidade.');
    if(record.dataPagamento&&!isDay(record.dataPagamento))throw Error('Data de pagamento inválida.');
    if(record.status==='pago'&&!record.dataPagamento)throw Error('Informe quando a licença foi paga.');
    if(record.status!=='pago'&&record.dataPagamento)throw Error('Remova a data de pagamento das licenças não pagas.');
    const result=evaluate(record,today);
    if(typeof record.total!=='number'||!Number.isFinite(record.total)||Math.abs(record.total-result.total)>0.001)throw Error('Total da licença não corresponde à quantidade × valor unitário.');
    return result;
  }
  function summary(items,today=todayUTC()){
    const totals={licenses:0,units:0,total:0,paid:0,pending:0,overdue:0,overdueDaysMax:0,paidValue:0,pendingValue:0,overdueValue:0};
    for(const item of items){
      const result=evaluate(item,today);
      totals.licenses++;totals.units+=Number(item.quantidade);totals.total+=result.total;
      totals[result.effectiveStatus==='pago'?'paid':result.effectiveStatus==='pendente'?'pending':'overdue']++;
      if(result.effectiveStatus==='pago')totals.paidValue+=result.total;
      else if(result.effectiveStatus==='pendente')totals.pendingValue+=result.total;
      else {totals.overdueValue+=result.total;totals.overdueDaysMax=Math.max(totals.overdueDaysMax,result.daysLate);}
    }
    for(const k of ['total','paidValue','pendingValue','overdueValue'])totals[k]=round(totals[k]);
    return totals;
  }
  return {evaluate,validate,summary,todayUTC,isDay};
});
