/* ACR OS Pro v1.7.5 — Cadastro de serviços, produtos e inventário empresarial.
 * Os dados são compartilhados via API, com revisão independente do restante das OS.
 */
window.OSAuth.ready.then(async () => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  if (!window.OSAuth.can('catalogo')) return;
  const status = $('#catalog-status');
  const forms = {services:$('#catalog-services-form'),products:$('#catalog-products-form'),equipments:$('#catalog-equipments-form')};
  const labels = {services:'Serviços',products:'Produtos',equipments:'Equipamentos'};
  const singular = {services:'Serviço',products:'Produto',equipments:'Equipamento'};
  const keys = Object.keys(forms);
  let state = null;
  let kind = 'equipments';
  let busy = false;
  const text = (s) => String(s ?? '');
  const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
  const uuid = () => crypto.randomUUID();
  const message = (s,error=false) => {status.textContent=s;status.classList.toggle('catalog-error',error);};
  const company = id => state?.companies?.find(x=>x.id===id)?.nome || (id?'Empresa não encontrada':'Sem empresa vinculada');

  function safeOption(select,id,name) {
    const option=document.createElement('option');option.value=id;option.textContent=name;
    select.append(option);
  }
  function companies(){
    for(const select of document.querySelectorAll('.catalog-company')){
      const current=select.value;
      select.replaceChildren();
      safeOption(select,'',select.required?'Selecione a empresa proprietária':'Todas / não vinculado');
      for(const company of state.companies) safeOption(select,company.id,company.nome);
      if([...select.options].some(o=>o.value===current))select.value=current;
    }
  }
  function types(){
    const list=$('#catalog-type-suggestions');list.replaceChildren();
    const items=[...new Set(state.equipments.map(e=>e.tipo).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    for(const item of items)safeOption(list,item,item);
  }
  function show(next){
    kind=next;
    for(const k of keys)forms[k].hidden=k!==kind;
    for(const btn of document.querySelectorAll('[data-catalog-kind]')){
      const selected=btn.dataset.catalogKind===kind;
      btn.classList.toggle('active',selected);
      btn.setAttribute('aria-pressed',selected?'true':'false');
    }
    $('#catalog-title-list').textContent=labels[kind]+' cadastrados';
    render();
  }
  function reset(form){
    form.reset();form.elements.namedItem('id').value='';
    form.querySelector('[type=submit]').textContent='Salvar '+singular[Object.keys(forms).find(k=>forms[k]===form)];
  }
  function recordSummary(record) {
    if(kind==='equipments'){
      return [
        'Tipo: '+text(record.tipo),'Empresa: '+company(record.empresaId),
        record.serie?'Série: '+record.serie:'Sem número de série',
        record.ip?'IP: '+record.ip:'',
        record.mac?'MAC: '+record.mac:'',
        record.local?'Local: '+record.local:'',
        record.status?'Status: '+record.status:''
      ].filter(Boolean).join(' • ');
    }
    return [
      record.codigo?'Código: '+record.codigo:'',
      record.empresaId?'Empresa: '+company(record.empresaId):'Uso geral',
      'Valor: '+money(record.valor),
      kind==='products'?'Estoque: '+record.quantidade+' '+(record.unidade||'unidades'):'Unidade: '+(record.unidade||'serviço')
    ].filter(Boolean).join(' • ');
  }
  function render(){
    if(!state)return;
    $('#catalog-count').textContent=String(state[kind].length)+' registro(s)';
    const filter=$('#catalog-filter').value.trim().toLocaleLowerCase('pt-BR');
    const owner=$('#catalog-company-filter').value;
    const container=$('#catalog-results');container.replaceChildren();
    const data=state[kind].filter(item=>{
      const joined=[item.nome,item.tipo,item.codigo,item.serie,item.ip,item.mac,item.modelo,item.fabricante,item.descricao,company(item.empresaId)].map(text).join(' ').toLocaleLowerCase('pt-BR');
      return (!owner||item.empresaId===owner) && (!filter||joined.includes(filter));
    });
    if(!data.length){const p=document.createElement('p');p.className='hint';p.textContent='Nenhum registro encontrado. Cadastre um novo item acima.';container.append(p);return;}
    for(const item of data){
      const article=document.createElement('article');article.className='catalog-card';
      const info=document.createElement('div');info.className='catalog-info';
      const heading=document.createElement('strong');heading.textContent=item.nome;
      const subtitle=document.createElement('small');subtitle.textContent=recordSummary(item);
      info.append(heading,subtitle);
      if(item.descricao||item.observacoes){const note=document.createElement('p');note.textContent=item.descricao||item.observacoes;info.append(note);}
      const actions=document.createElement('div');actions.className='actions';
      for(const [label,action] of [['Editar','edit'],['Excluir','delete']]){
        const button=document.createElement('button');button.type='button';
        button.className=action==='delete'?'danger':'outline';button.textContent=label;
        button.dataset.catalogAction=action;button.dataset.catalogId=item.id;
        actions.append(button);
      }
      article.append(info,actions);container.append(article);
    }
  }
  function hydrate(form,item){
    for(const input of form.elements){
      if(!input.name)continue;
      input.value=text(item[input.name]??'');
    }
    form.querySelector('[type=submit]').textContent='Salvar alterações';
    form.scrollIntoView({behavior:'smooth',block:'start'});
    form.querySelector('input[name=nome]')?.focus();
  }
  async function reload(){
    if(busy)return;
    busy=true;message('Carregando catálogo do servidor...');
    try{
      const next=await window.OSTeam.fetchCatalog();
      state=next;companies();types();
      const filter=$('#catalog-company-filter');const selected=filter.value;
      filter.replaceChildren();safeOption(filter,'','Todas as empresas');
      for(const c of state.companies)safeOption(filter,c.id,c.nome);
      if([...filter.options].some(x=>x.value===selected))filter.value=selected;
      render();message('Catálogo sincronizado com o servidor.');
    }catch(e){message('Falha ao carregar: '+e.message,true);}
    finally{busy=false;}
  }
  async function update(next,success){
    if(busy)return false;
    busy=true;message('Salvando registros no servidor...');
    try{
      const response=await window.OSTeam.saveCatalog(next);
      state=response;companies();types();render();message(success);
      return true;
    }catch(e){
      const conflict=e.status===409;
      message(conflict?'Conflito: outro aparelho alterou o catálogo. Seus campos continuam preenchidos. Atualize e tente novamente.':e.message,true);
      return false;
    }finally{busy=false;}
  }
  for(const k of keys){
    forms[k].addEventListener('submit',async e=>{
      e.preventDefault();
      if(!state||!forms[k].reportValidity())return;
      const f=Object.fromEntries(new FormData(forms[k]).entries());
      for(const name of ['nome','tipo','serie','ip','mac','codigo','modelo','fabricante','local','descricao','observacoes'])if(name in f)f[name]=f[name].trim();
      if(k==='equipments'&&!f.empresaId)return message('Selecione a empresa proprietária.',true);
      if(k==='equipments'&&f.mac&&!/^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(f.mac))return message('MAC inválido. Use AA:BB:CC:DD:EE:FF.',true);
      if(k==='equipments'&&f.serie&&state.equipments.some(x=>x.id!==f.id&&x.empresaId===f.empresaId&&text(x.serie).toLowerCase()===f.serie.toLowerCase()))return message('Já existe equipamento com essa série na empresa.',true);
      if(k!=='equipments'){f.valor=Number(f.valor||0);if(k==='products')f.quantidade=Number(f.quantidade||0);}
      const record={...f,id:f.id||uuid()};
      const next={revision:state.revision,services:[...state.services],products:[...state.products],equipments:[...state.equipments]};
      const index=next[k].findIndex(x=>x.id===record.id);
      if(index>=0)next[k][index]=record;else next[k].unshift(record);
      const saved=await update(next,singular[k]+' salvo(a) e sincronizado(a).');
      if(saved)reset(forms[k]);
    });
    forms[k].querySelector('[data-catalog-reset]').onclick=()=>reset(forms[k]);
  }
  $('#catalog-results').addEventListener('click',async e=>{
    const button=e.target.closest('[data-catalog-action]');if(!button||!state)return;
    const record=state[kind].find(x=>x.id===button.dataset.catalogId);if(!record)return;
    if(button.dataset.catalogAction==='edit'){hydrate(forms[kind],record);return;}
    if(!confirm('Excluir '+record.nome+' do cadastro?'))return;
    const next={revision:state.revision,services:[...state.services],products:[...state.products],equipments:[...state.equipments]};
    next[kind]=next[kind].filter(x=>x.id!==record.id);
    await update(next,'Registro excluído do catálogo.');
  });
  document.querySelectorAll('[data-catalog-kind]').forEach(b=>b.onclick=()=>show(b.dataset.catalogKind));
  $('#catalog-filter').oninput=render;
  $('#catalog-company-filter').onchange=render;
  $('#catalog-refresh').onclick=reload;
  show(kind);await reload();
});
