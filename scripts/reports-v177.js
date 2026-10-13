/* ACR OS Pro v1.7.7 — relatórios de patrimônio, catálogo e despesas de locomoção. */
window.OSAuth.ready.then(async function(){
  'use strict';
  const $=s=>document.querySelector(s),model=window.ACRReportsModel,auth=window.OSAuth;
  if(!auth.can('relatorios'))return;
  const hasCatalog=auth.can('catalogo'),hasFinance=auth.can('financeiro');
  const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
  const n=v=>Number(v)||0;
  const label=v=>String(v??'').trim(),stamp=()=>new Date().toLocaleString('pt-BR');
  const date=v=>String(v||'').split('-').reverse().join('/');
  $('#report-equipment').hidden=!hasCatalog;$('#report-catalog').hidden=!hasCatalog;$('#report-travel').hidden=!hasFinance;
  let catalog=null,pending=null;
  const getCompany=()=>window.OSReportData?.company()||'ACR Suporte em T.I';
  const getFinance=()=>window.OSReportData?.finance()||[];
  const choose=(selector,items,placeholder)=>{
    const select=$(selector),old=select.value;select.replaceChildren(new Option(placeholder,''));
    for(const item of items)select.add(new Option(item[1],item[0]));
    if([...select.options].some(x=>x.value===old))select.value=old;
  };
  const fill=(target,colCount,rows)=>{
    const body=$(target);body.replaceChildren();
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=colCount;td.textContent='Nenhum registro encontrado com estes filtros.';tr.append(td);body.append(tr);}
    for(const row of rows){const tr=document.createElement('tr');for(const val of row){const td=document.createElement('td');td.textContent=String(val??'');tr.append(td);}body.append(tr);}
  };
  const status=(message,error=false)=>{const node=$('#report-extended-status');node.textContent=message;node.classList.toggle('trip-error',error);};
  function inventory(){
    if(!catalog)return null;
    const filter={companyId:$('#report-eq-company').value,type:$('#report-eq-type').value,status:$('#report-eq-status').value,search:$('#report-eq-search').value};
    const r=model.equipmentReport(catalog.equipments,catalog.companies,filter);
    $('#report-eq-count').textContent=r.count;$('#report-eq-companies').textContent=r.companies;$('#report-eq-types-count').textContent=r.types;
    const rows=r.items.map(x=>[x.empresa,x.nome,x.tipo,[x.fabricante,x.modelo].filter(Boolean).join(' / '),x.serie||'—',x.ip||'—',x.mac||'—',x.local||'—',x.status||'—']);
    fill('#report-eq-body',9,rows);
    return {reportType:'equipment',title:'Equipamentos por empresa',generatedAt:stamp(),company:getCompany(),
      filtersText:'Empresa: '+($('#report-eq-company').selectedOptions[0]?.textContent||'Todas')+' | Tipo: '+(filter.type||'Todos')+' | Situação: '+(filter.status||'Todas')+' | Busca: '+(filter.search||'Nenhuma'),
      metrics:[{label:'Equipamentos',value:r.count},{label:'Empresas',value:r.companies},{label:'Tipos',value:r.types}],
      columns:['Empresa','Equipamento','Tipo','Marca/modelo','Série','IP','MAC','Local','Situação'],rows,
      summaryColumns:['Empresa','Quantidade'],summaryRows:r.groups.map(g=>[g.name,g.items.length]),
      groups:r.groups.map(g=>({heading:g.name,items:g.items.map(x=>({title:x.nome+' • '+x.tipo,lines:[
        'Série: '+(x.serie||'—')+' | IP: '+(x.ip||'—')+' | MAC: '+(x.mac||'—'),
        'Marca/modelo: '+([x.fabricante,x.modelo].filter(Boolean).join(' / ')||'—')+' | Local: '+(x.local||'—')+' | Situação: '+(x.status||'—'),
        x.observacoes?'Observações: '+x.observacoes:''
      ].filter(Boolean)}))}))};
  }
  function products(){
    if(!catalog)return null;
    const filter={companyId:$('#report-cat-company').value,category:$('#report-cat-kind').value,search:$('#report-cat-search').value};
    const r=model.catalogReport(catalog.services,catalog.products,catalog.companies,filter);
    $('#report-cat-count').textContent=r.count;$('#report-cat-products').textContent=r.products;$('#report-cat-services').textContent=r.services;
    fill('#report-cat-body',8,r.items.map(x=>[x.empresa,x.category,x.nome,x.codigo||'',x.unidade||'',x.category==='Produto'?x.quantidade:'',money(x.valor),x.descricao||'']));
    return {reportType:'catalog',title:'Produtos e serviços por empresa',generatedAt:stamp(),company:getCompany(),
      filtersText:'Empresa: '+($('#report-cat-company').selectedOptions[0]?.textContent||'Todas')+' | Categoria: '+(filter.category||'Todas')+' | Busca: '+(filter.search||'Nenhuma'),
      metrics:[{label:'Itens',value:r.count},{label:'Produtos',value:r.products},{label:'Serviços',value:r.services}],
      columns:['Empresa','Categoria','Nome','Código','Unidade','Quantidade','Valor (R$)','Descrição'],
      rows:r.items.map(x=>[x.empresa,x.category,x.nome,x.codigo||'',x.unidade||'',x.category==='Produto'?x.quantidade:'',n(x.valor),x.descricao||'']),
      summaryColumns:['Empresa','Itens'],summaryRows:r.groups.map(g=>[g.name,g.items.length]),
      groups:r.groups.map(g=>({heading:g.name,items:g.items.map(x=>({title:x.category+' — '+x.nome,lines:[
        'Código: '+(x.codigo||'—')+' | Valor: '+money(x.valor)+' | Unidade: '+(x.unidade||'—'),
        x.category==='Produto'?'Estoque: '+(x.quantidade||0):'',x.descricao?'Descrição: '+x.descricao:''
      ].filter(Boolean)}))}))};
  }
  function travel(){
    if(!hasFinance)return null;
    const filter={from:$('#report-trip-from').value,to:$('#report-trip-to').value,order:$('#report-trip-os').value.trim()};
    if(filter.from&&filter.to&&filter.from>filter.to){status('Data inicial maior que data final.',true);return null;}
    const r=model.travelReport(getFinance(),filter),t=r.total;
    $('#report-trip-count').textContent=t.count;
    $('#report-trip-km').textContent=Number(t.km).toLocaleString('pt-BR')+' km';
    $('#report-trip-total').textContent=money(t.valor);
    $('#report-trip-amounts').textContent='Custo km: '+money(t.custoKm)+' • Combustível: '+money(t.abastecimento)+' ('+money(t.abastecimentoSomado)+' somados) • Hospedagem: '+money(t.hospedagem)+' • Alimentação: '+money(t.alimentacao);
    fill('#report-trip-body',14,r.items.map(x=>[date(x.data),x.osNumero||'—',x.viagem.veiculo||'—',x.viagem.kmInicial,x.viagem.kmAtual,x.viagem.kmRodados,money(x.viagem.tarifaKm),money(x.viagem.custoKm),money(x.viagem.abastecimento),x.viagem.tanqueCompleto?'Sim':'Não',x.viagem.incluirAbastecimento===false?'Não':'Sim',money(x.viagem.hospedagem),money(x.viagem.alimentacao),money(x.valor)]));
    return {reportType:'travel',title:'Viagens e locomoção por OS',generatedAt:stamp(),company:getCompany(),
      filtersText:'De '+(filter.from?date(filter.from):'início')+' até '+(filter.to?date(filter.to):'hoje')+' | OS: '+(filter.order||'Todas'),
      metrics:[{label:'Viagens',value:t.count},{label:'Km rodados',value:t.km},{label:'Custo km',value:money(t.custoKm)},{label:'Abastecimento',value:money(t.abastecimento)},{label:'Hospedagem',value:money(t.hospedagem)},{label:'Alimentação',value:money(t.alimentacao)},{label:'Total',value:money(t.valor)}],
      columns:['Data','OS','Veículo','Km inicial','Km atual','Km rodados','Tarifa R$/km','Custo km R$','Abastec. R$','Tanque completo','Abastec. incluso','Hospedagem R$','Alimentação R$','Total R$'],
      rows:r.items.map(x=>[x.data,x.osNumero||'',x.viagem.veiculo||'',n(x.viagem.kmInicial),n(x.viagem.kmAtual),n(x.viagem.kmRodados),n(x.viagem.tarifaKm),n(x.viagem.custoKm),n(x.viagem.abastecimento),x.viagem.tanqueCompleto?'Sim':'Não',x.viagem.incluirAbastecimento===false?'Não':'Sim',n(x.viagem.hospedagem),n(x.viagem.alimentacao),n(x.valor)]),
      summaryColumns:['OS','Km','Despesas R$'],summaryRows:r.groups.map(g=>[g.name,g.km,g.valor]),
      groups:r.groups.map(g=>({heading:g.name+' • '+g.km+' km • '+money(g.valor),items:g.items.map(x=>({title:date(x.data)+' — '+(x.viagem.veiculo||'Viagem')+' — '+money(x.valor),lines:[
        'Km: '+x.viagem.kmInicial+' → '+x.viagem.kmAtual+' | Rodados: '+x.viagem.kmRodados+' | Tarifa: '+money(x.viagem.tarifaKm)+'/km | Custo km: '+money(x.viagem.custoKm),
        'Abastecimento: '+money(x.viagem.abastecimento)+' | Tanque completo: '+(x.viagem.tanqueCompleto?'Sim':'Não')+' | Somado: '+(x.viagem.incluirAbastecimento===false?'Não':'Sim'),
        'Hospedagem: '+money(x.viagem.hospedagem)+' | Alimentação: '+money(x.viagem.alimentacao),
        x.viagem.observacoes?'Observações: '+x.viagem.observacoes:''
      ].filter(Boolean)}))}))};
  }
  function render(){if(hasCatalog&&catalog){inventory();products();}if(hasFinance)travel();}
  async function reload(){
    if(!hasCatalog){render();return;}
    status('Atualizando inventário e catálogo a partir do servidor...');
    try{
      catalog=await window.OSTeam.fetchCatalog();
      const companies=catalog.companies.map(c=>[c.id,c.nome]);
      choose('#report-eq-company',companies,'Todas as empresas');
      choose('#report-cat-company',companies,'Todas as empresas');
      const types=[...new Set(catalog.equipments.map(x=>label(x.tipo)).filter(Boolean))].sort();
      choose('#report-eq-type',types.map(x=>[x,x]),'Todos os tipos');
      const statuses=[...new Set(catalog.equipments.map(x=>label(x.status)).filter(Boolean))].sort();
      choose('#report-eq-status',statuses.map(x=>[x,x]),'Todas as situações');
      render();status('Dados do catálogo sincronizados com o servidor.');
    }catch(error){status('Falha ao carregar dados: '+error.message,true);}
  }
  for(const s of ['#report-eq-company','#report-eq-type','#report-eq-status','#report-eq-search','#report-cat-company','#report-cat-kind','#report-cat-search','#report-trip-from','#report-trip-to','#report-trip-os']){
    const x=$(s);if(x)x.addEventListener('input',render);
  }
  $('#report-ext-refresh').onclick=reload;
  const escapeCsv=s=>{
    let value=String(s??'');if(/^[\t\r\n ]*[=+\-@]/.test(value))value="'"+value;
    return '"'+value.replace(/"/g,'""')+'"';
  };
  async function fallback(format,data){
    if(format==='xlsx'){
      const csv='\uFEFF'+[data.columns,...data.rows].map(r=>r.map(escapeCsv).join(';')).join('\r\n');
      const uri=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');a.href=uri;a.download='ACR-Relatorio-'+data.reportType+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),30000);
      return 'CSV compatível com Excel gerado.';
    }
    const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const w=window.open('','_blank');if(!w)throw Error('Permita pop-ups para imprimir.');
    const rows=data.rows.map(r=>'<tr>'+r.map(x=>'<td>'+safe(x)+'</td>').join('')+'</tr>').join('');
    w.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>'+safe(data.title)+'</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#102d4e}h1{background:#102d4e;color:white;padding:14px;border-bottom:4px solid #d8a02c}table{width:100%;border-collapse:collapse}td,th{padding:5px;border:1px solid #b2c3d5;overflow-wrap:anywhere}th{background:#102d4e;color:white}tr{break-inside:avoid}</style><h1>ACR Suporte em T.I — '+safe(data.title)+'</h1><p>'+safe(data.generatedAt)+' — '+safe(data.filtersText)+'</p><table><thead><tr>'+data.columns.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></html>');
    w.document.close();w.print();return 'Escolha Salvar como PDF na impressão.';
  }
  const previous=window.OSApp?.onServiceReportSaved;
  if(typeof previous==='function'){
    window.OSApp.onServiceReportSaved=function(raw){
      if(!pending)return previous.call(this,raw);
      const title=pending;pending=null;
      try{
        const response=typeof raw==='string'?JSON.parse(raw):raw;
        status(response.success?title+' salvo em Downloads/OS-Pro: '+response.name:'Falha ao exportar: '+(response.error||'erro'),!response.success);
      }catch(e){status('Falha ao processar PDF/Excel: '+e.message,true);}
      for(const b of document.querySelectorAll('[data-report-export]'))b.disabled=false;
    };
  }
  document.querySelectorAll('[data-report-export]').forEach(button=>button.onclick=async()=>{
    const type=button.dataset.reportExport,format=button.dataset.reportFormat;
    if((type==='equipment'||type==='catalog')&&!hasCatalog||type==='travel'&&!hasFinance||pending)return;
    const data=type==='equipment'?inventory():type==='catalog'?products():travel();
    if(!data)return status('Relatório indisponível. Confira os filtros.',true);
    if(!data.rows.length)return status('Nenhum registro no filtro escolhido.',true);
    status('Preparando '+data.title+'...');
    if(window.Android?.exportServiceReport){
      pending=data.title;
      for(const b of document.querySelectorAll('[data-report-export]'))b.disabled=true;
      window.Android.exportServiceReport(format,JSON.stringify(data));
      return;
    }
    try{status(await fallback(format,data));}catch(e){status(e.message,true);}
  });
  if(hasCatalog)await reload();else render();
});
