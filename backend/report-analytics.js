'use strict';
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.ACRReportsModel=value;})(typeof window!=='undefined'?window:null,function(){
  const txt=v=>String(v??'').trim();
  const number=n=>Number.isFinite(Number(n))?Number(n):0;
  const cash=v=>Math.round((v+Number.EPSILON)*100)/100;
  const compare=(a,b)=>txt(a).localeCompare(txt(b),'pt-BR');
  function equipmentReport(equipments,companies,filter={}){
    const owners=new Map((companies||[]).map(c=>[c.id,txt(c.nome)]));
    const search=txt(filter.search).toLocaleLowerCase('pt-BR');
    const items=(equipments||[]).filter(e=>{
      if(filter.companyId&&e.empresaId!==filter.companyId)return false;
      if(filter.type&&txt(e.tipo)!==filter.type)return false;
      if(filter.status&&txt(e.status)!==filter.status)return false;
      const haystack=[e.nome,e.tipo,e.serie,e.ip,e.mac,e.modelo,e.fabricante,e.local,owners.get(e.empresaId)].map(txt).join(' ').toLocaleLowerCase('pt-BR');
      return !search||haystack.includes(search);
    }).map(e=>({...e,empresa:owners.get(e.empresaId)||'Empresa não encontrada'}))
      .sort((a,b)=>compare(a.empresa,b.empresa)||compare(a.tipo,b.tipo)||compare(a.nome,b.nome));
    const groups=[];for(const e of items){let g=groups.find(x=>x.id===e.empresaId);if(!g){g={id:e.empresaId,name:e.empresa,items:[]};groups.push(g);}g.items.push(e);}
    return {items,groups,count:items.length,companies:groups.length,types:new Set(items.map(x=>x.tipo)).size};
  }
  function catalogReport(services,products,companies,filter={}){
    const owners=new Map((companies||[]).map(c=>[c.id,txt(c.nome)])),items=[];
    for(const [category,list] of [['Serviço',services||[]],['Produto',products||[]]]){
      for(const e of list){
        if(filter.companyId&&e.empresaId!==filter.companyId)continue;
        if(filter.category&&category!==filter.category)continue;
        const empresa=e.empresaId?(owners.get(e.empresaId)||'Empresa não encontrada'):'Uso geral';
        const haystack=[e.nome,e.codigo,e.descricao,empresa].map(txt).join(' ').toLocaleLowerCase('pt-BR');
        if(filter.search&&!haystack.includes(txt(filter.search).toLocaleLowerCase('pt-BR')))continue;
        items.push({...e,empresa,category,valor:number(e.valor),quantidade:category==='Produto'?number(e.quantidade):null});
      }
    }
    items.sort((a,b)=>compare(a.empresa,b.empresa)||compare(a.category,b.category)||compare(a.nome,b.nome));
    const groups=[];for(const item of items){const key=item.empresa;if(!groups.some(g=>g.name===key))groups.push({name:key,items:[]});groups.find(g=>g.name===key).items.push(item);}
    return {items,groups,count:items.length,services:items.filter(i=>i.category==='Serviço').length,products:items.filter(i=>i.category==='Produto').length};
  }
  function travelReport(finance,filter={}){
    const query=txt(filter.order).toLocaleLowerCase('pt-BR');
    const items=(finance||[]).filter(x=>x&&x.categoria==='viagem'&&x.tipo==='despesa'&&x.viagem)
      .filter(x=>(!filter.from||x.data>=filter.from)&&(!filter.to||x.data<=filter.to)&&(!query||txt(x.osNumero).toLocaleLowerCase('pt-BR').includes(query)))
      .map(x=>({...x,viagem:{...x.viagem},valor:number(x.valor)}))
      .sort((a,b)=>compare(b.data,a.data)||compare(a.osNumero,b.osNumero));
    const total={km:0,custoKm:0,abastecimento:0,abastecimentoSomado:0,hospedagem:0,alimentacao:0,valor:0,count:items.length};
    const groups=[];
    for(const x of items){
      const t=x.viagem;
      total.km+=number(t.kmRodados);total.custoKm+=number(t.custoKm);
      total.abastecimento+=number(t.abastecimento);
      if(t.incluirAbastecimento!==false)total.abastecimentoSomado+=number(t.abastecimento);
      total.hospedagem+=number(t.hospedagem);total.alimentacao+=number(t.alimentacao);total.valor+=x.valor;
      const key=txt(x.osNumero)||'Sem OS vinculada';
      let g=groups.find(g=>g.name===key);if(!g){g={name:key,items:[],valor:0,km:0};groups.push(g);}
      g.items.push(x);g.valor+=x.valor;g.km+=number(t.kmRodados);
    }
    for(const key of Object.keys(total)){if(key!=='count')total[key]=cash(total[key]);}
    for(const g of groups){g.valor=cash(g.valor);g.km=cash(g.km);}
    groups.sort((a,b)=>compare(a.name,b.name));
    return {items,groups,total};
  }
  return {equipmentReport,catalogReport,travelReport};
});
