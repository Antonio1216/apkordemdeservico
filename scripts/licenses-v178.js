/* ACR OS Pro v1.7.8 — Licenças de Software (servidor com revisão independente). */
window.OSAuth.ready.then(async function(){
  'use strict';
  if(!window.OSAuth.can('licencas'))return;
  const model=window.ACRLicenses,$=s=>document.querySelector(s);
  const form=$('#license-form'),message=$('#license-form-status'),pdfMessage=$('#license-report-status');
  const cash=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
  const localDate=d=>d?d.split('-').reverse().join('/'):'Não informado';
  let state=null,saving=false,pdfPending=false;
  const today=()=>model.todayUTC();
  const currentStatus=(r)=>model.evaluate(r,today());
  const text=(v)=>String(v??'');
  const showMessage=(msg,error=false)=>{message.textContent=msg;message.classList.toggle('license-error',error);};
  const showPdf=(msg,error=false)=>{pdfMessage.textContent=msg;pdfMessage.classList.toggle('license-error',error);};
  const sel=(name)=>form.elements.namedItem(name);
  const uuid=()=>crypto.randomUUID();
  const option=(select,value,label)=>select.add(new Option(label,value));
  function fillCompanyOptions(){
    if(!state)return;
    for(const [select,placeholder] of [[sel('empresaId'),'Sem vínculo'],[$('#license-company-filter'),'Todas as empresas']]){
      const chosen=select.value;select.replaceChildren();option(select,'',placeholder);
      for(const c of state.companies)option(select,c.id,c.nome);
      if([...select.options].some(x=>x.value===chosen))select.value=chosen;
    }
  }
  function calc(){
    const q=Number(sel('quantidade').value),p=Number(sel('valorUnitario').value);
    const total=Number.isFinite(q)&&Number.isFinite(p)&&q>=1&&p>=0?Math.round((q*p+Number.EPSILON)*100)/100:0;
    $('#license-total').textContent=cash(total);
    const due=sel('vencimento').value,stage=sel('status').value;
    if(!due||!model.isDay(due)){
      $('#license-expiration').textContent='Informe o vencimento para acompanhar o prazo.';
    }else{
      const sample={quantidade:Math.max(1,q||1),valorUnitario:Math.max(0,p||0),vencimento:due,status:stage==='atrasado'?'pendente':stage};
      try{
        const evaluated=model.evaluate(sample,today());
        $('#license-expiration').textContent=evaluated.effectiveStatus==='pago'?'Pagamento registrado.':
          evaluated.daysLate>0?'Atrasado há '+evaluated.daysLate+' dia(s).':
          'Vencimento: '+localDate(due)+' · '+(due===today()?'vence hoje':'pendente');
      }catch(e){$('#license-expiration').textContent=e.message;}
    }
    $('#license-expiration').classList.toggle('license-error',Boolean(due&&stage!=='pago'&&due<today()));
    return total;
  }
  function reset(){
    form.reset();sel('id').value='';sel('quantidade').value='1';sel('valorUnitario').value='0';sel('status').value='pendente';
    $('#license-save').textContent='Salvar licença';showMessage('');calc();
  }
  function record(){
    const r=Object.fromEntries(new FormData(form).entries());
    for(const key of ['software','tipoLicenca','unidade','descricao','fornecedor'])r[key]=text(r[key]).trim();
    r.id=r.id||uuid();r.quantidade=Number(r.quantidade);r.valorUnitario=Number(r.valorUnitario);
    r.total=calc();
    if(r.status==='pago'&&!r.dataPagamento)r.dataPagamento=today();
    if(r.status!=='pago')r.dataPagamento='';
    if(r.status==='atrasado'&&r.vencimento>=today())throw Error('Atrasado só pode ser selecionado se o vencimento já passou.');
    model.validate(r,today());
    return r;
  }
  function filtered(){
    if(!state)return [];
    const query=$('#license-search').value.toLocaleLowerCase('pt-BR').trim(),
      stage=$('#license-status-filter').value,company=$('#license-company-filter').value;
    const owners=new Map(state.companies.map(x=>[x.id,x.nome]));
    return state.items.filter(r=>{
      const s=currentStatus(r);
      const hay=[r.software,r.tipoLicenca,r.fornecedor,r.descricao,owners.get(r.empresaId)].map(text).join(' ').toLocaleLowerCase('pt-BR');
      return (!stage||s.effectiveStatus===stage)&&(!company||r.empresaId===company)&&(!query||hay.includes(query));
    }).sort((a,b)=>a.vencimento.localeCompare(b.vencimento)||a.software.localeCompare(b.software,'pt-BR'));
  }
  function render(){
    if(!state)return;
    const totals=model.summary(state.items,today());
    $('#license-count').textContent=totals.licenses;
    $('#license-sum').textContent=cash(totals.total);
    $('#license-paid-count').textContent=totals.paid;
    $('#license-late-count').textContent=totals.overdue;
    $('#license-status-totals').textContent='Pagas: '+cash(totals.paidValue)+' • Pendentes: '+cash(totals.pendingValue)+' • Atrasadas: '+cash(totals.overdueValue)+
      ' • Total de unidades: '+totals.units;
    const container=$('#license-list');container.replaceChildren();
    const owners=new Map(state.companies.map(x=>[x.id,x.nome]));
    const list=filtered();
    if(!list.length){
      const p=document.createElement('p');p.className='hint';p.textContent='Nenhuma licença encontrada. Cadastre um software ou altere os filtros.';container.append(p);return;
    }
    for(const r of list){
      const evald=currentStatus(r);
      const article=document.createElement('article');article.className='license-card';
      const info=document.createElement('div');info.className='license-card-info';
      const name=document.createElement('strong');name.textContent=r.software;
      const badge=document.createElement('span');badge.className='license-tag license-'+evald.effectiveStatus;
      badge.textContent=evald.effectiveStatus==='pago'?'PAGO':evald.effectiveStatus==='atrasado'?'ATRASADO · '+evald.daysLate+' dia(s)':'PENDENTE';
      const detail=document.createElement('p');detail.textContent=
        r.tipoLicenca+' • '+r.quantidade+' '+r.unidade+' × '+cash(r.valorUnitario)+' = '+cash(r.total)+
        ' • Vencimento: '+localDate(r.vencimento)+
        (r.empresaId?' • Empresa: '+(owners.get(r.empresaId)||'Empresa desconhecida'):'')+
        (r.dataPagamento?' • Pago em '+localDate(r.dataPagamento):'');
      info.append(name,badge,detail);
      if(r.descricao){const description=document.createElement('p');description.textContent=r.descricao;info.append(description);}
      if(r.fornecedor){const provider=document.createElement('small');provider.textContent='Fornecedor: '+r.fornecedor;info.append(provider);}
      const buttons=document.createElement('div');buttons.className='actions';
      for(const [action,label] of [['edit','Editar'],['delete','Excluir']]){
        const button=document.createElement('button');button.type='button';button.dataset.licenseAction=action;button.dataset.licenseId=r.id;
        button.className=action==='delete'?'danger':'outline';button.textContent=label;buttons.append(button);
      }
      article.append(info,buttons);container.append(article);
    }
  }
  function hydrate(r){
    form.reset();
    for(const [name,value] of Object.entries(r)){
      const input=sel(name);if(input)input.value=text(value);
    }
    $('#license-save').textContent='Salvar alterações';calc();form.scrollIntoView({behavior:'smooth',block:'start'});sel('software').focus();
  }
  async function reload(){
    if(saving)return;
    saving=true;$('#license-save').disabled=true;showMessage('Buscando licenças no servidor...');
    try{
      const result=await window.OSTeam.fetchLicenses();
      state=result;fillCompanyOptions();render();showMessage('Licenças sincronizadas com o servidor.');
    }catch(e){showMessage('Não foi possível carregar licenças: '+e.message,true);}
    finally{saving=false;$('#license-save').disabled=false;}
  }
  async function persist(next,success){
    if(saving)return false;
    saving=true;$('#license-save').disabled=true;showMessage('Salvando no servidor...');
    try{
      state=await window.OSTeam.saveLicenses(next);render();showMessage(success);return true;
    }catch(e){
      showMessage(e.status===409?'Conflito: dados alterados em outro aparelho. Os campos permanecem preenchidos. Atualize, revise e salve novamente.':e.message,true);return false;
    }finally{saving=false;$('#license-save').disabled=false;}
  }
  form.addEventListener('input',calc);
  sel('status').addEventListener('change',()=>{
    if(sel('status').value==='pago'&&!sel('dataPagamento').value)sel('dataPagamento').value=today();
    if(sel('status').value!=='pago')sel('dataPagamento').value='';
    calc();
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!state||!form.reportValidity())return;
    let r;try{r=record();}catch(err){showMessage(err.message,true);return;}
    const next={revision:state.revision,items:[...state.items]},idx=next.items.findIndex(x=>x.id===r.id);
    if(idx<0)next.items.unshift(r);else next.items[idx]=r;
    if(await persist(next,'Licença salva e sincronizada.'))reset();
  });
  $('#license-clear').onclick=reset;
  $('#license-list').addEventListener('click',async event=>{
    const button=event.target.closest('[data-license-action]');if(!button||!state)return;
    const r=state.items.find(x=>x.id===button.dataset.licenseId);if(!r)return;
    if(button.dataset.licenseAction==='edit'){hydrate(r);return;}
    if(!confirm('Excluir a licença "'+r.software+'" do cadastro?'))return;
    const next={revision:state.revision,items:state.items.filter(x=>x.id!==r.id)};
    await persist(next,'Licença excluída do cadastro.');
  });
  $('#license-search').oninput=render;
  $('#license-status-filter').onchange=render;
  $('#license-company-filter').onchange=render;
  $('#license-refresh').onclick=reload;
  function payload(){
    const items=filtered(),totals=model.summary(items,today()),owners=new Map(state.companies.map(x=>[x.id,x.nome]));
    const groups=new Map();
    for(const r of items){
      const name=owners.get(r.empresaId)||'Sem empresa vinculada';
      if(!groups.has(name))groups.set(name,[]);
      const s=currentStatus(r);
      groups.get(name).push({title:r.software+' — '+r.tipoLicenca+' — '+cash(r.total),lines:[
        'Unidades: '+r.quantidade+' '+r.unidade+' | Valor unitário: '+cash(r.valorUnitario)+' | TOTAL: '+cash(r.total),
        'Vencimento: '+localDate(r.vencimento)+' | Situação: '+(s.effectiveStatus==='pago'?'PAGO':s.effectiveStatus==='atrasado'?'ATRASADO':'PENDENTE')+' | Dias de atraso: '+s.daysLate,
        r.dataPagamento?'Data de pagamento: '+localDate(r.dataPagamento):'Pagamento ainda não registrado',
        r.fornecedor?'Fornecedor: '+r.fornecedor:'',
        'Descrição: '+(r.descricao||'Não informada')
      ].filter(Boolean)});
    }
    const rows=items.map(r=>{
      const s=currentStatus(r);
      return [owners.get(r.empresaId)||'Sem vínculo',r.software,r.tipoLicenca,r.unidade,r.quantidade,r.valorUnitario,r.total,r.vencimento,s.effectiveStatus,s.daysLate,r.dataPagamento,r.fornecedor,r.descricao];
    });
    return {reportType:'licenses',title:'Relatório detalhado de licenças de software',
      company:'ACR Suporte em T.I',generatedAt:new Date().toLocaleString('pt-BR'),
      filtersText:'Situação: '+($('#license-status-filter').selectedOptions[0]?.textContent||'Todas')+' | Empresa: '+($('#license-company-filter').selectedOptions[0]?.textContent||'Todas')+' | Busca: '+($('#license-search').value||'Nenhuma'),
      metrics:[{label:'Licenças',value:totals.licenses},{label:'Unidades',value:totals.units},{label:'Total geral',value:cash(totals.total)},
        {label:'Pagas',value:totals.paid+' • '+cash(totals.paidValue)},{label:'Pendentes',value:totals.pending+' • '+cash(totals.pendingValue)},{label:'Atrasadas',value:totals.overdue+' • '+cash(totals.overdueValue)}],
      groups:[...groups].map(([heading,entries])=>({heading,items:entries})),
      columns:['Empresa','Software','Tipo de licença','Unidade','Quantidade','Valor unitário (R$)','Total (R$)','Vencimento','Status','Dias de atraso','Data de pagamento','Fornecedor','Descrição'],rows,
      summaryColumns:['Empresa','Licenças','Total (R$)'],summaryRows:[...groups].map(([heading])=>[heading,...(()=>{
        const subgroup=items.filter(x=>(owners.get(x.empresaId)||'Sem empresa vinculada')===heading);return [subgroup.length,model.summary(subgroup,today()).total];
      })()])};
  }
  const older=window.OSApp?.onServiceReportSaved;
  if(typeof older==='function'){
    window.OSApp.onServiceReportSaved=function(raw){
      if(!pdfPending)return older.call(this,raw);
      pdfPending=false;$('#license-export-pdf').disabled=false;
      try{
        const result=typeof raw==='string'?JSON.parse(raw):raw;
        showPdf(result.success?'PDF salvo em Downloads/OS-Pro: '+result.name:'Não foi possível salvar PDF: '+(result.error||'erro desconhecido'),!result.success);
      }catch(e){showPdf('Falha no retorno da exportação: '+e.message,true);}
    };
  }
  $('#license-export-pdf').onclick=()=>{
    if(!state)return showPdf('Atualize os dados antes de gerar PDF.',true);
    const data=payload();
    if(!data.rows.length)return showPdf('Nenhuma licença encontrada com os filtros atuais.',true);
    if(pdfPending)return;
    if(window.Android?.exportServiceReport){
      pdfPending=true;$('#license-export-pdf').disabled=true;showPdf('Gerando PDF corporativo...');
      try{window.Android.exportServiceReport('pdf',JSON.stringify(data));}catch(e){pdfPending=false;$('#license-export-pdf').disabled=false;showPdf(e.message,true);}
      return;
    }
    const safe=s=>text(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const w=window.open('','_blank');if(!w)return showPdf('Permita abrir a janela de impressão.',true);
    const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>'+safe(data.title)+'</title><style>@page{size:A4;margin:14mm}body{font:11px Arial;color:#102d4e}h1{background:#102d4e;color:#fff;padding:16px;border-bottom:4px solid #d6a83a}h2{background:#eef3f9;padding:8px}article{padding:10px;border-bottom:1px solid #b2c2d7;break-inside:avoid}p{line-height:1.5;margin:3px 0}strong{font-size:12px}</style><h1>ACR Suporte em T.I — '+safe(data.title)+'</h1><p>Emitido em '+safe(data.generatedAt)+'</p><p>'+safe(data.filtersText)+'</p>'+data.metrics.map(x=>'<p><b>'+safe(x.label)+':</b> '+safe(x.value)+'</p>').join('')+data.groups.map(g=>'<h2>'+safe(g.heading)+'</h2>'+g.items.map(i=>'<article><strong>'+safe(i.title)+'</strong>'+i.lines.map(line=>'<p>'+safe(line)+'</p>').join('')+'</article>').join('')).join('')+'</html>';
    w.document.write(html);w.document.close();w.print();showPdf('Escolha "Salvar como PDF" na janela de impressão.');
  };
  reset();await reload();
});
