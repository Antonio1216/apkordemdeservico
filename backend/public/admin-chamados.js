'use strict';
(() => {
  let bearer='',account=null,companies=[],technicians=[],latestTickets=[];
  const el=id=>document.getElementById(id);
  const msg=message=>{el('message').textContent=message;};
  const escapeText=x=>String(x??'');
  const unique=arr=>Array.isArray(arr)?arr:[];
  const companyName=id=>companies.find(c=>c.id===id)?.nome||'Empresa não encontrada';
  const isContractor=c=>c?.tipoEmpresa==='terceirizada';
  async function request(p,method='GET',data,needAuth=true){
    const headers={'Accept':'application/json'};
    if(needAuth){if(!bearer)throw Error('Faça login novamente.');headers.Authorization='Bearer '+bearer;}
    if(data!==undefined)headers['Content-Type']='application/json';
    const response=await fetch('/api/team/'+p,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
    const result=await response.json().catch(()=>({}));
    if(response.status===401&&needAuth)logout('Sessão expirada. Entre novamente.');
    if(!response.ok)throw Error(result.error||'Servidor indisponível. Tente novamente.');
    return result;
  }
  function loginView(show){
    el('login-section').hidden=!show;
    el('admin-area').hidden=show;
    if(show)el('login').focus();
  }
  function logout(message='Você saiu do painel.'){
    bearer='';account=null;companies=[];technicians=[];latestTickets=[];
    el('login-form').reset();el('link-result').hidden=true;el('portal-link').value='';
    loginView(true);msg(message);
  }
  async function action(form,fn,localStatus){
    const button=form.querySelector('[type=submit]');
    button.disabled=true;msg('Aguarde...');
    if(localStatus)localStatus.textContent='Salvando...';
    try{await fn(new FormData(form));}catch(error){
      const message=error.message||'Falha na solicitação.';
      msg(message);if(localStatus)localStatus.textContent=message;
    }
    finally{button.disabled=false;}
  }
  function selectOptions(select,items,prompt,allowNone=false){
    const current=select.value;
    select.replaceChildren(new Option(prompt,''));
    if(allowNone)select.add(new Option('Sem empresa — bloquear acesso','__sem_empresa__'));
    for(const item of items)select.add(new Option(item.nome,item.id));
    if(Array.from(select.options).some(o=>o.value===current))select.value=current;
  }
  function renderDelegations(){
    const list=el('delegation-list');
    const count=el('delegation-count');
    if(!list||!count)return;
    list.replaceChildren();
    count.textContent=technicians.length+' técnico(s)';
    if(!technicians.length){
      const empty=document.createElement('p');
      empty.className='hint';empty.textContent='Nenhum técnico cadastrado. Cadastre um técnico acima para delegar seu acesso.';
      list.append(empty);return;
    }
    const sorted=[...technicians].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    for(const technician of sorted){
      const company=companies.find(x=>x.id===technician.empresaId);
      const authorized=Boolean(company)&&!isContractor(company);
      const card=document.createElement('article');
      card.className='delegation-item'+(authorized?'':' unassigned');
      const title=document.createElement('h4');title.textContent=technician.nome;card.append(title);
      const login=document.createElement('p');login.textContent='Login: '+(technician.login||'Não informado');
      card.append(login);
      const assignment=document.createElement('p');
      assignment.textContent='Empresa autorizada: '+(company?.nome||(technician.empresaId?'Empresa não encontrada':'Nenhuma'));
      card.append(assignment);
      const access=document.createElement('p');
      access.className='delegation-access';
      access.textContent=authorized?'Acesso aos chamados: autorizado para esta empresa':'Acesso aos chamados: não habilitado para clientes';
      card.append(access);
      const button=document.createElement('button');button.type='button';button.className='secondary';
      button.textContent='Alterar delegação de '+technician.nome;
      button.setAttribute('aria-label','Alterar delegação de '+technician.nome);
      button.addEventListener('click',()=>{
        el('delegate-tech').value=technician.id;
        syncAssignment();
        el('delegate-tech').focus();
        el('delegate-form').scrollIntoView({block:'center',behavior:'smooth'});
      });
      card.append(button);
      list.append(card);
    }
  }
  function refreshCompanyLinks(){
    const outsource=el('outsourcing-company'),final=el('final-company');
    const previousOutsource=outsource.value,previousFinal=final.value;
    outsource.replaceChildren(new Option('Cadastrar nova terceirizada','__nova__'));
    final.replaceChildren(new Option('Cadastrar novo cliente final','__nova__'));
    for(const c of companies){
      if(c.tipoEmpresa!=='cliente-final')outsource.add(new Option(c.nome,c.id));
      if(!isContractor(c))final.add(new Option(c.nome,c.id));
    }
    outsource.value=[...outsource.options].some(o=>o.value===previousOutsource)?previousOutsource:'__nova__';
    final.value=[...final.options].some(o=>o.value===previousFinal)?previousFinal:'__nova__';
    toggleCompanyInputs();
    const list=el('company-link-list');list.replaceChildren();
    const linked=companies.filter(x=>x.tipoEmpresa==='cliente-final'&&x.terceirizadaId);
    if(!linked.length){const note=document.createElement('p');note.className='hint';note.textContent='Nenhum vínculo cadastrado ainda.';list.append(note);return;}
    for(const c of linked){
      const card=document.createElement('article');card.className='relationship';
      const name=document.createElement('strong');name.textContent=c.nome;card.append(name);
      const p=document.createElement('p');p.textContent='Terceirizada responsável: '+(c.terceirizadaNome||companyName(c.terceirizadaId));
      card.append(p);list.append(card);
    }
  }
  function toggleCompanyInputs(){
    for(const [selectId,labelId,inputId] of [
      ['outsourcing-company','outsourcing-new-label','outsourcing-new'],
      ['final-company','final-new-label','final-new']
    ]){
      const create=el(selectId).value==='__nova__';
      el(labelId).hidden=!create;
      el(inputId).required=create;
      if(!create)el(inputId).value='';
    }
  }
  async function refresh(){
    const [c,u]=await Promise.all([request('companies'),request('users')]);
    companies=unique(c.companies);
    technicians=unique(u.users).filter(x=>x.perfil==='Técnico'&&x.active!==false);
    el('companies-count').textContent=companies.length+' empresa(s) cadastrada(s).';
    el('technicians-count').textContent=technicians.length+' técnico(s) cadastrado(s).';
    selectOptions(el('delegate-tech'),technicians.map(t=>({id:t.id,nome:t.nome+' — '+(t.empresaId?companyName(t.empresaId):'Sem empresa')})),'Selecione um técnico');
    const customerCompanies=companies.filter(c=>!isContractor(c));
    selectOptions(el('delegate-company'),customerCompanies,'Selecione o cliente final',true);
    selectOptions(el('portal-company'),customerCompanies,'Selecione o cliente final');
    syncAssignment();
    renderDelegations();
    refreshCompanyLinks();
  }
  function syncAssignment(){
    const technician=technicians.find(t=>t.id===el('delegate-tech').value);
    if(technician)el('delegate-company').value=technician.empresaId||'__sem_empresa__';
  }
  function line(card,value){
    const p=document.createElement('p');p.textContent=value;card.append(p);
  }
  function printTickets(res){
    latestTickets=unique(res.tickets);
    const list=el('ticket-list');list.replaceChildren();
    const novos=unique(res.novos);
    const n=el('ticket-notice');n.hidden=!novos.length;
    n.textContent=novos.length?novos.length+' novo(s) chamado(s) aguardando visualização.':'';
    if(!latestTickets.length){list.textContent='Nenhum chamado registrado ainda.';return;}
    for(const t of latestTickets){
      const article=document.createElement('article');article.className='chamado';
      const h=document.createElement('h3');h.textContent=(t.tipo||'Chamado')+' — '+(t.status||'Aberto');article.append(h);
      const company=companies.find(c=>c.id===t.empresaId);
      line(article,'Cliente final: '+companyName(t.empresaId));
      if(company?.terceirizadaId)line(article,'Terceirizada responsável: '+(company.terceirizadaNome||companyName(company.terceirizadaId)));
      line(article,'Técnico: '+(technicians.find(x=>x.id===t.tecnicoId)?.nome||'Não identificado'));
      line(article,'Equipamento / Local: '+(t.equipamento||'Sem identificação')+' / '+(t.localEquipamento||'Não informado'));
      line(article,'Problema: '+(t.descricao||''));
      if(t.criadoEm)line(article,'Abertura: '+new Date(t.criadoEm).toLocaleString('pt-BR'));
      if(t.localizacao){
        const a=document.createElement('a');
        a.href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(t.localizacao.lat)+'&mlon='+encodeURIComponent(t.localizacao.lon)+'#map=17/'+encodeURIComponent(t.localizacao.lat)+'/'+encodeURIComponent(t.localizacao.lon);
        a.target='_blank';a.rel='noopener noreferrer';a.textContent='Ver localização autorizada';
        article.append(a);
      }
      for(const file of unique(t.evidencias)){
        const btn=document.createElement('button');btn.type='button';btn.className='secondary';
        btn.textContent='Baixar evidência: '+escapeText(file.nome);
        btn.onclick=async()=>{try{
          const r=await request('tickets/'+encodeURIComponent(t.id)+'/evidence-data/'+encodeURIComponent(file.id));
          const binary=atob(r.data),buf=new Uint8Array(binary.length);
          for(let i=0;i<binary.length;i++)buf[i]=binary.charCodeAt(i);
          const url=URL.createObjectURL(new Blob([buf],{type:r.tipo||'application/octet-stream'}));
          const a=document.createElement('a');a.href=url;a.download=r.nome||'evidencia';a.click();
          setTimeout(()=>URL.revokeObjectURL(url),15000);
        }catch(e){msg(e.message);}};
        article.append(btn,document.createTextNode(' '));
      }
      const form=document.createElement('form');form.className='actions';
      const label=document.createElement('label');label.textContent='Atualizar situação';
      const sel=document.createElement('select');sel.name='status';sel.required=true;
      for(const state of ['Aberto','Em atendimento','Aguardando cliente','Concluído'])sel.add(new Option(state,state));
      sel.value=t.status||'Aberto';label.append(sel);
      const save=document.createElement('button');save.type='submit';save.textContent='Salvar situação';
      form.append(label,save);
      form.onsubmit=e=>{e.preventDefault();action(form,async()=>{
        await request('tickets/'+encodeURIComponent(t.id)+'/status','POST',{status:sel.value});
        await refreshTickets();msg('Situação do chamado atualizada.');
      });};
      article.append(form);list.append(article);
    }
  }
  async function refreshTickets(){
    if(!bearer)return;
    printTickets(await request('tickets'));
  }
  el('login-form').addEventListener('submit',e=>{
    e.preventDefault();
    action(e.currentTarget,async f=>{
      const result=await request('login','POST',{login:String(f.get('login')||'').trim(),senha:String(f.get('senha')||'')},false);
      if(result.account?.perfil!=='Administrador')throw Error('Esta área é exclusiva de administradores.');
      bearer=result.token;account=result.account;
      el('login-form').reset();el('welcome').textContent='Administrador: '+account.nome;
      await refresh();await refreshTickets();loginView(false);msg('Acesso autorizado. Selecione uma empresa e um técnico para começar.');
    });
  });
  el('refresh').addEventListener('click',async()=>{try{await refresh();await refreshTickets();msg('Dados atualizados.');}catch(e){msg(e.message);}});
  el('logout').addEventListener('click',()=>logout());
  el('delegate-tech').addEventListener('change',syncAssignment);
  el('outsourcing-company').addEventListener('change',toggleCompanyInputs);
  el('final-company').addEventListener('change',toggleCompanyInputs);
  el('company-link-form').addEventListener('submit',e=>{
    e.preventDefault();action(e.currentTarget,async f=>{
      const outsourcedId=String(f.get('terceirizadaId')||'');
      const finalId=String(f.get('clienteFinalId')||'');
      const body={
        ...(outsourcedId==='__nova__'?{terceirizadaNome:String(f.get('terceirizadaNome')||'').trim()}:{terceirizadaId:outsourcedId}),
        ...(finalId==='__nova__'?{clienteFinalNome:String(f.get('clienteFinalNome')||'').trim()}:{clienteFinalId:finalId})
      };
      const saved=await request('companies/link','POST',body);
      await refresh();
      const customer=companies.find(x=>x.id===saved.clienteFinal.id);
      if(!customer||customer.terceirizadaId!==saved.terceirizada.id)throw Error('Vínculo criado, mas não foi possível verificar a atualização. Recarregue os dados.');
      el('delegate-company').value=customer.id;
      el('portal-company').value=customer.id;
      e.currentTarget.reset();toggleCompanyInputs();
      const confirmation='Vínculo salvo: '+saved.terceirizada.nome+' atende '+saved.clienteFinal.nome+'. Selecione um técnico para o cliente final.';
      el('company-link-feedback').textContent=confirmation;
      msg(confirmation);
    },el('company-link-feedback'));
  });
  el('new-company-form').addEventListener('submit',e=>{
    e.preventDefault();action(e.currentTarget,async f=>{
      const c=await request('companies','POST',{nome:String(f.get('nome')||'').trim()});
      e.currentTarget.reset();await refresh();
      if(c.company?.id)el('portal-company').value=c.company.id;
      msg('Empresa cadastrada. Agora delegue o técnico responsável.');
    });
  });
  el('new-tech-form').addEventListener('submit',e=>{
    e.preventDefault();action(e.currentTarget,async f=>{
      const r=await request('users','POST',{
        nome:String(f.get('nome')||'').trim(),login:String(f.get('login')||'').trim(),
        email:String(f.get('email')||'').trim(),senha:String(f.get('senha')||''),perfil:'Técnico'
      });
      e.currentTarget.reset();await refresh();
      if(r.user?.id)el('delegate-tech').value=r.user.id;
      syncAssignment();msg('Técnico cadastrado. Selecione sua empresa e salve a delegação.');
    });
  });
  el('delegate-form').addEventListener('submit',e=>{
    e.preventDefault();action(e.currentTarget,async f=>{
      const empresaId=f.get('empresaId')==='__sem_empresa__'?'':String(f.get('empresaId')||'');
      if(!empresaId&&f.get('empresaId')!=='__sem_empresa__')throw Error('Escolha uma empresa.');
      const selected=String(f.get('tecnicoId')||'');
      await request('users/'+encodeURIComponent(selected)+'/company','PUT',{empresaId});
      await refresh();
      el('delegate-tech').value=selected;syncAssignment();
      const saved=technicians.find(t=>t.id===selected);
      if(!saved||String(saved.empresaId||'')!==empresaId){
        throw Error('A delegação não foi confirmada na atualização. Consulte a lista e tente novamente.');
      }
      const message=empresaId?
        'Delegação salva e confirmada! '+saved.nome+' está autorizado para '+companyName(empresaId)+'.':
        'Delegação removida e confirmada. '+saved.nome+' não aparecerá para os clientes selecionarem.';
      el('delegation-feedback').textContent=message;
      msg(message);
    },el('delegation-feedback'));
  });
  el('portal-form').addEventListener('submit',e=>{
    e.preventDefault();action(e.currentTarget,async f=>{
      const id=String(f.get('empresaId')||'');
      const r=await request('customer-portals','POST',{empresaId:id});
      el('portal-link').value=r.link;el('link-result').hidden=false;
      msg('Link exclusivo criado para '+companyName(id)+'. Compartilhe apenas com o cliente autorizado.');
    });
  });
  el('copy-link').addEventListener('click',async()=>{
    const link=el('portal-link').value;if(!link)return;
    try{await navigator.clipboard.writeText(link);msg('Link copiado com sucesso.');}
    catch{el('portal-link').focus();el('portal-link').select();msg('Selecione e copie o link exibido.');}
  });
  el('share-link').addEventListener('click',async()=>{
    const link=el('portal-link').value;if(!link)return;
    if(navigator.share){try{await navigator.share({title:'Portal ACR OS Pro — Chamados',url:link});}catch{}}
    else{el('portal-link').focus();el('portal-link').select();msg('Compartilhamento indisponível. Copie o link.');}
  });
  el('refresh-tickets').addEventListener('click',()=>refreshTickets().catch(e=>msg(e.message)));
  el('seen-tickets').addEventListener('click',async()=>{
    try{const r=await request('tickets');await request('tickets/seen','POST',{ids:unique(r.novos)});
      await refreshTickets();msg('Chamados marcados como visualizados.');}
    catch(e){msg(e.message);}
  });
  setInterval(()=>{if(bearer&&!document.hidden)refreshTickets().catch(()=>{});},30000);
})();