/* ACR OS Pro v1.7.9 — RHiD monitoring, read-only from Render API. */
window.OSAuth.ready.then(async()=>{
  'use strict';
  if(!window.OSAuth.can('rhid'))return;
  const $=s=>document.querySelector(s), status=$('#rhid-message'),pdfStatus=$('#rhid-export-status');
  let snapshot=null,busy=false,pdfPending=false;
  const txt=v=>String(v??''),date=v=>v?new Date(v).toLocaleString('pt-BR'):'Não informada';
  const note=(message,error=false)=>{status.textContent=message;status.classList.toggle('rhid-error',error);};
  const pdfNote=(message,error=false)=>{pdfStatus.textContent=message;pdfStatus.classList.toggle('rhid-error',error);};
  const stateLabel=s=>s==='online'?'Online':s==='offline'?'Offline':'Não identificado';
  const list=$('#rhid-equipment-list'),history=$('#rhid-events');
  function filters(){
    if(!snapshot?.configured)return [];
    const phrase=$('#rhid-search').value.trim().toLocaleLowerCase('pt-BR');
    const stage=$('#rhid-status-filter').value,company=$('#rhid-company-filter').value;
    return snapshot.devices.filter(d=>(!stage||stage===d.status)&&(!company||company===d.empresaId)&&
      (!phrase||[d.nome,d.serie,d.empresa,d.versao,d.statusOriginal].some(x=>txt(x).toLocaleLowerCase('pt-BR').includes(phrase))))
      .sort((a,b)=>a.empresa.localeCompare(b.empresa,'pt-BR')||a.nome.localeCompare(b.nome,'pt-BR'));
  }
  function el(type,cls,value){
    const node=document.createElement(type);
    if(cls)node.className=cls;
    if(value!==undefined)node.textContent=txt(value);
    return node;
  }
  function render(){
    for(const [key,val] of [['#rhid-total',snapshot?.summary?.total],['#rhid-online',snapshot?.summary?.online],
      ['#rhid-offline',snapshot?.summary?.offline],['#rhid-unknown',snapshot?.summary?.unknown]])
      $(key).textContent=typeof val==='number'?val:'—';
    $('#rhid-updated').textContent=snapshot?.updatedAt?'Última consulta ao RHiD: '+date(snapshot.updatedAt):'';
    const sel=$('#rhid-company-filter'),old=sel.value;sel.replaceChildren(new Option('Todas as empresas',''));
    if(snapshot?.configured){
      const companies=[...new Set(snapshot.devices.map(x=>x.empresa).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      for(const name of companies){
        const item=snapshot.devices.find(x=>x.empresa===name);
        // "Não vinculada" can be selected by empty company filter? Keep only mapped companies.
        if(item?.empresaId)sel.add(new Option(name,item.empresaId));
      }
      if([...sel.options].some(x=>x.value===old))sel.value=old;
    }
    list.replaceChildren();history.replaceChildren();
    if(!snapshot?.configured){
      list.append(el('p','hint','Aguardando configuração da API RHiD no servidor Render. Nenhum equipamento foi consultado.'));return;
    }
    const devices=filters();
    if(!devices.length)list.append(el('p','hint','Nenhum equipamento encontrado com os filtros escolhidos.'));
    for(const d of devices){
      const card=el('article','rhid-card');
      const info=el('div','rhid-card-info');info.append(el('strong','',d.nome));
      info.append(el('span','rhid-badge rhid-'+d.status,stateLabel(d.status)));
      info.append(el('p','',[
        'Série: '+(d.serie||'Não informada'),
        'Empresa: '+(d.empresa||'Não vinculada'),
        'Versão: '+(d.versao||'Não informada'),
        'Última conexão: '+date(d.ultimaConexao),
        'Última sincronização: '+date(d.ultimaSincronizacao)
      ].join(' • ')));
      if(d.status==='offline')info.append(el('p','rhid-offline-text','Atenção: equipamento informado como desconectado pelo RHiD.'));
      if(d.status==='desconhecido')info.append(el('p','hint','O RHiD não informou um estado online/offline reconhecido.'));
      card.append(info);list.append(card);
    }
    if(!snapshot.events?.length)history.append(el('p','hint','Nenhuma mudança de conectividade registrada até agora.'));
    else for(const event of snapshot.events.slice(0,40)){
      const p=el('p','rhid-history',date(event.em)+' — '+event.nome+' (série '+(event.serie||'?')+
        '): '+stateLabel(event.antes)+' → '+stateLabel(event.depois));
      history.append(p);
    }
  }
  async function refresh(){
    if(busy)return;
    busy=true;$('#rhid-refresh').disabled=true;note('Consultando o RHiD por meio do servidor Render...');
    try{
      const response=await window.OSTeam.fetchRhidMonitor();
      snapshot=response;render();
      note(response.configured?
        'Consulta concluída. '+response.summary.total+' equipamentos, '+response.summary.online+
          ' online, '+response.summary.offline+' offline e '+response.summary.unknown+' sem status identificado.':
        (response.message||'API RHiD ainda não configurada no servidor.'));
    }catch(e){
      // Never claim "online" using stale data when an upstream request failed.
      snapshot=null;render();
      note('Falha na consulta ao RHiD: '+e.message+'. Verifique a conexão e as permissões no Render.',true);
    }finally{busy=false;$('#rhid-refresh').disabled=false;}
  }
  function report(){
    const devices=filters();if(!devices.length)throw Error('Nenhum equipamento disponível para relatório.');
    const groups=new Map();
    for(const d of devices){
      const company=d.empresa||'Não vinculada';if(!groups.has(company))groups.set(company,[]);
      groups.get(company).push({title:d.nome+' — '+stateLabel(d.status),
        lines:['Número de série: '+(d.serie||'Não informada'),'Versão: '+(d.versao||'Não informada'),
          'Última conexão: '+date(d.ultimaConexao),'Última sincronização: '+date(d.ultimaSincronizacao),
          'Status reportado: '+(d.statusOriginal||'Não informado')]});
    }
    const statusCount=s=>devices.filter(d=>d.status===s).length;
    const generated=new Date().toLocaleString('pt-BR');
    return {reportType:'rhid',title:'Relatório de disponibilidade dos equipamentos RHiD',
      company:'ACR Suporte em T.I',generatedAt:generated,
      filtersText:'Situação: '+$('#rhid-status-filter').selectedOptions[0].textContent+
        ' | Empresa: '+$('#rhid-company-filter').selectedOptions[0].textContent+
        ' | Pesquisa: '+($('#rhid-search').value||'Nenhuma')+
        ' | Última consulta ao RHiD: '+date(snapshot.updatedAt),
      metrics:[{label:'Equipamentos',value:devices.length},{label:'Online',value:statusCount('online')},
        {label:'Offline',value:statusCount('offline')},{label:'Não identificado',value:statusCount('desconhecido')}],
      groups:[...groups].map(([heading,items])=>({heading,items})),
      columns:['Empresa','Equipamento','Série','Situação','Status RHiD','Versão','Última conexão','Última sincronização'],
      rows:devices.map(d=>[d.empresa,d.nome,d.serie,stateLabel(d.status),d.statusOriginal,d.versao,date(d.ultimaConexao),date(d.ultimaSincronizacao)]),
      summaryColumns:['Empresa','Total','Online','Offline','Não identificado'],
      summaryRows:[...groups].map(([name])=>{const subset=devices.filter(d=>d.empresa===name);
        return [name,subset.length,...['online','offline','desconhecido'].map(s=>subset.filter(d=>d.status===s).length)];})};
  }
  const previous=window.OSApp?.onServiceReportSaved;
  if(typeof previous==='function'){
    window.OSApp.onServiceReportSaved=function(raw){
      if(!pdfPending)return previous.call(this,raw);
      pdfPending=false;$('#rhid-export-pdf').disabled=false;
      try{
        const result=typeof raw==='string'?JSON.parse(raw):raw;
        pdfNote(result.success?'PDF salvo: '+(result.name||'Downloads/OS-Pro'):'Erro ao salvar PDF: '+(result.error||'desconhecido'),!result.success);
      }catch(e){pdfNote('Falha ao confirmar exportação: '+e.message,true);}
    };
  }
  $('#rhid-export-pdf').onclick=()=>{
    if(!snapshot?.configured)return pdfNote('Conecte a API RHiD e consulte os equipamentos primeiro.',true);
    let data;try{data=report();}catch(e){return pdfNote(e.message,true);}
    if(pdfPending)return;
    if(window.Android?.exportServiceReport){
      pdfPending=true;$('#rhid-export-pdf').disabled=true;pdfNote('Gerando relatório PDF...');
      try{window.Android.exportServiceReport('pdf',JSON.stringify(data));}
      catch(e){pdfPending=false;$('#rhid-export-pdf').disabled=false;pdfNote(e.message,true);}return;
    }
    const clean=x=>txt(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const w=window.open('','_blank');if(!w)return pdfNote('Permita a janela de impressão para salvar o relatório em PDF.',true);
    const markup='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório RHiD</title>'+
      '<style>@page{size:A4;margin:14mm}body{font:11px Arial;color:#102d4e}h1{background:#102d4e;color:white;padding:18px;border-bottom:4px solid #dfa93c}h2{background:#eef3f9;padding:9px}article{padding:10px;border-bottom:1px solid #bfd0dd;break-inside:avoid}p{line-height:1.5}</style>'+
      '<h1>'+clean(data.company)+' — '+clean(data.title)+'</h1><p>Emitido em '+clean(data.generatedAt)+'</p>'+
      '<p>'+clean(data.filtersText)+'</p>'+data.metrics.map(m=>'<p><b>'+clean(m.label)+':</b> '+clean(m.value)+'</p>').join('')+
      data.groups.map(g=>'<h2>'+clean(g.heading)+'</h2>'+g.items.map(x=>'<article><b>'+clean(x.title)+'</b>'+
        x.lines.map(line=>'<p>'+clean(line)+'</p>').join('')+'</article>').join('')).join('')+'</html>';
    w.document.write(markup);w.document.close();w.print();pdfNote('Selecione Salvar como PDF na janela de impressão.');
  };
  $('#rhid-refresh').onclick=refresh;
  $('#rhid-search').oninput=render;
  $('#rhid-status-filter').onchange=render;
  $('#rhid-company-filter').onchange=render;
  document.querySelector('[data-tab="rhid"]')?.addEventListener('click',()=>{if(snapshot===null)refresh();});
  // Auto-update every five minutes while the application is visible.
  const interval=setInterval(()=>{if(document.visibilityState==='visible'&&snapshot?.configured)refresh();},300000);
  window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
  await refresh();
});
