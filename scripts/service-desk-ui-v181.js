/* ACR OS Pro: service desk, scoped technician delegation and in-app alerts. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const status=(box,s)=>{if(box)box.textContent=s;};
const api=(path,method,data)=>window.OSAuth.serviceDeskRequest(path,method||'GET',data);
function el(tag,props){return Object.assign(document.createElement(tag),props||{});}
function option(label,value){return new Option(label,value);}
function text(p,s){p.append(document.createTextNode(String(s||'')));}
function showPage(){
 const pane=$('#chamados'),nav=$('[data-tab="chamados"]');
 if(!pane)return;
 if(nav&&window.OSAuth.current?.perfil==='Atendimento')nav.hidden=true;
}
async function adminPanel(){
 if(!window.OSAuth.isAdmin())return;
 const container=$('#usuarios');
 if(!container)return;
 const card=el('div',{className:'panel',id:'delegation-panel'});
 card.innerHTML=[
  '<h2>Delegação de técnicos e acesso do cliente</h2>',
  '<p>Vincule o técnico a uma empresa. Clientes só poderão selecionar técnicos delegados à sua empresa.</p>',
  '<form id="delegate-form"><label for="delegate-tech">Técnico</label>',
  '<select id="delegate-tech" required></select>',
  '<label for="delegate-company">Empresa delegada</label>',
  '<select id="delegate-company" required></select>',
  '<button class="primary" type="submit">Salvar delegação</button></form>',
  '<hr><h3>Link privado para o cliente abrir chamados</h3>',
  '<form id="portal-form"><label for="portal-company">Empresa</label>',
  '<select id="portal-company" required></select>',
  '<button type="submit" class="primary">Gerar / renovar link da empresa</button></form>',
  '<label for="portal-link">Compartilhe este link somente com o cliente autorizado</label>',
  '<input id="portal-link" type="url" readonly aria-label="Link do portal do cliente">',
  '<button id="copy-portal" type="button">Copiar link</button>',
  '<p id="delegation-status" role="status" aria-live="polite"></p>'
 ].join('');
 container.append(card);
 const message=$('#delegation-status');
 async function update(){
  const [a,b]=await Promise.all([api('companies'),api('users')]);
  const companies=a.companies||[],users=b.users||[];
  const company=$('#delegate-company'),portal=$('#portal-company'),tech=$('#delegate-tech');
  const previousTech=tech.value,previousCompany=company.value;
  tech.replaceChildren(option('Escolha um técnico',''));
  for(const u of users.filter(x=>x.perfil==='Técnico'))tech.add(option(u.nome+' — '+(companies.find(c=>c.id===u.empresaId)?.nome||'Sem empresa atribuída'),u.id));
  company.replaceChildren(option('Escolha a empresa',''),option('Sem empresa (acesso bloqueado)','__bloquear__'));
  portal.replaceChildren(option('Escolha a empresa',''));
  for(const c of companies){company.add(option(c.nome,c.id));portal.add(option(c.nome,c.id));}
  if(users.some(x=>x.id===previousTech))tech.value=previousTech;
  if(companies.some(x=>x.id===previousCompany))company.value=previousCompany;
  const found=users.find(x=>x.id===tech.value);
  if(found)company.value=found.empresaId||'__bloquear__';
  tech.onchange=()=>{const selected=users.find(x=>x.id===tech.value);company.value=selected?.empresaId||'__bloquear__';};
 }
 $('#delegate-form').addEventListener('submit',async e=>{
  e.preventDefault();status(message,'Salvando...');
  try{
   const company=$('#delegate-company').value;
   if(!company)throw Error('Escolha uma empresa para delegação.');
   await api('users/'+encodeURIComponent($('#delegate-tech').value)+'/company','PUT',{empresaId:company==='__bloquear__'?'':company});
   await update();status(message,'Delegação salva. As sessões antigas do técnico foram revogadas.');
  }catch(err){status(message,err.message);}
 });
 $('#portal-form').addEventListener('submit',async e=>{
  e.preventDefault();status(message,'Gerando link...');
  try{
   const result=await api('customer-portals','POST',{empresaId:$('#portal-company').value});
   $('#portal-link').value=result.link;
   status(message,'Link criado. O link anterior dessa empresa foi revogado. Compartilhe somente com o responsável autorizado.');
  }catch(err){status(message,err.message);}
 });
 $('#copy-portal').onclick=async()=>{
  const value=$('#portal-link').value;
  if(!value)return status(message,'Gere um link primeiro.');
  try{await navigator.clipboard.writeText(value);status(message,'Link copiado.');}
  catch{const input=$('#portal-link');input.select();status(message,'Selecione e copie o link manualmente.');}
 };
 try{await update();}catch(err){status(message,'Não foi possível carregar empresas e técnicos: '+err.message);}
}
async function saveEvidence(ticketId,file){
 const result=await api('tickets/'+encodeURIComponent(ticketId)+'/evidence-data/'+encodeURIComponent(file.id));
 const binary=atob(result.data),buffer=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)buffer[i]=binary.charCodeAt(i);
 const url=URL.createObjectURL(new Blob([buffer],{type:result.tipo}));
 const a=el('a',{href:url,download:result.nome||'evidencia'});
 a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
const seenNotices=new Set();
async function refreshTickets(){
 if(!['Administrador','Técnico'].includes(window.OSAuth.current?.perfil))return;
 const result=await api('tickets');
 const nav=$('[data-tab="chamados"]'),notice=$('#app-ticket-alert'),list=$('#ticket-list');
 const count=result.novos?.length||0;
 if(nav)nav.textContent='Chamados'+(count?' ('+count+' novos)':'');
 if(notice){
  notice.hidden=count===0;
  notice.textContent=count?'Você tem '+count+' chamado(s) novo(s) para verificar.':'';
 }
 if(count){
  for(const id of result.novos){if(!seenNotices.has(id)){seenNotices.add(id);}}
 }
 if(!list)return;
 list.replaceChildren();
 if(!result.tickets?.length){list.textContent='Nenhum chamado atribuído para sua empresa.';return;}
 for(const t of result.tickets){
  const card=el('article',{className:'panel'});
  const h=el('h3',{textContent:t.tipo+' · '+t.status});card.append(h);
  const company=(t.empresaId||'').slice(0,10);
  for(const value of [t.descricao,'Equipamento: '+(t.equipamento||'não informado'),
    'Local: '+t.localEquipamento,'Aberto: '+new Date(t.criadoEm).toLocaleString('pt-BR')]){
   card.append(el('p',{textContent:value}));
  }
  if(t.localizacao){
   const a=el('a',{textContent:'Visualizar localização autorizada',target:'_blank',rel:'noopener noreferrer',
    href:'https://www.openstreetmap.org/?mlat='+encodeURIComponent(t.localizacao.lat)+'&mlon='+encodeURIComponent(t.localizacao.lon)+'#map=17/'+encodeURIComponent(t.localizacao.lat)+'/'+encodeURIComponent(t.localizacao.lon)});
   card.append(a);
  }
  for(const f of t.evidencias||[]){
   const btn=el('button',{type:'button',textContent:'Baixar evidência: '+f.nome});
   btn.onclick=()=>saveEvidence(t.id,f).catch(err=>status($('#ticket-status'),err.message));
   card.append(btn);
  }
  const form=el('form');form.style.marginTop='12px';
  const label=el('label',{textContent:'Atualizar situação: '});
  const select=el('select',{name:'status'});
  for(const opt of ['Aberto','Em atendimento','Aguardando cliente','Concluído'])select.add(option(opt,opt));
  select.value=t.status;label.append(select);form.append(label);
  form.append(el('button',{type:'submit',textContent:'Salvar situação',className:'primary'}));
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   try{await api('tickets/'+t.id+'/status','POST',{status:select.value});status($('#ticket-status'),'Chamado atualizado.');await refreshTickets();}
   catch(err){status($('#ticket-status'),err.message);}
  });
  card.append(form);list.append(card);
 }
}
async function start(){
 showPage();
 if(window.OSAuth.isAdmin())await adminPanel();
 if(!['Administrador','Técnico'].includes(window.OSAuth.current?.perfil))return;
 const alert=el('div',{id:'app-ticket-alert',role:'status',hidden:true});
 alert.style.cssText='position:fixed;z-index:10000;bottom:14px;right:12px;left:12px;background:#0f426a;color:white;padding:12px;border-radius:8px;box-shadow:0 4px 16px #0006;max-width:650px;margin:auto;';
 document.body.append(alert);
 $('#ticket-refresh')?.addEventListener('click',()=>refreshTickets().catch(e=>status($('#ticket-status'),e.message)));
 $('#tickets-seen')?.addEventListener('click',async()=>{
  try{const data=await api('tickets');await api('tickets/seen','POST',{ids:data.novos});await refreshTickets();}
  catch(e){status($('#ticket-status'),e.message);}
 });
 try{await refreshTickets();}catch(e){status($('#ticket-status'),e.message);}
 setInterval(()=>{if(!document.hidden)refreshTickets().catch(()=>{});},30000);
}
document.addEventListener('DOMContentLoaded',()=>{window.OSAuth?.ready?.then(start).catch(()=>{});});
})();
