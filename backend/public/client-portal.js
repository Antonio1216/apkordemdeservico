'use strict';
(() => {
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 const $=s=>document.querySelector(s);
 const state={location:null,techs:[]};
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const notice=$('#notice');
 async function api(path,method='GET',payload){
  const response=await fetch('/api/team/'+path,{method,
   headers:{'X-Client-Portal':token,...(payload?{'Content-Type':'application/json'}:{})},
   body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Não foi possível consultar o servidor.');
  return data;
 }
 async function load(){
  const data=await api('customer/info');
  $('#company').textContent=data.empresa;
  state.techs=data.tecnicos;
  const selector=$('#technician'),previous=selector.value;
  selector.replaceChildren(new Option('Selecione o técnico responsável',''));
  for(const t of state.techs)selector.add(new Option(t.nome,t.id));
  if(state.techs.some(x=>x.id===previous))selector.value=previous;
  if(!state.techs.length)notice.textContent='Sua empresa ainda não possui técnico delegado. Solicite a atribuição ao administrador.';
  await tickets();
 }
 async function tickets(){
  try{
   const response=await api('customer/tickets'),box=$('#tickets');
   box.replaceChildren();
   if(!response.tickets.length){box.textContent='Nenhum chamado aberto ainda.';return;}
   for(const t of response.tickets){
    const card=document.createElement('article');card.className='ticket';
    const h=document.createElement('h3');h.textContent=t.tipo+' — '+t.status;card.append(h);
    for(const item of ['Equipamento: '+(t.equipamento||'Não informado'),'Local: '+t.localEquipamento,
      'Problema: '+t.descricao,'Aberto em: '+new Date(t.criadoEm).toLocaleString('pt-BR'),
      'Atualizado em: '+new Date(t.atualizadoEm).toLocaleString('pt-BR')]){
     const p=document.createElement('p');p.textContent=item;card.append(p);
    }
    for(const ev of t.evidencias||[]){
     const btn=document.createElement('button');btn.type='button';btn.textContent='Baixar '+ev.nome;
     btn.addEventListener('click',()=>downloadEvidence(t.id,ev.id,ev.nome));card.append(btn);
    }
    box.append(card);
   }
  }catch(err){$('#tickets').textContent=err.message;}
 }
 async function downloadEvidence(ticketId,fileId,name){
  try{
   const response=await fetch('/api/team/customer/tickets/'+encodeURIComponent(ticketId)+'/evidence/'+encodeURIComponent(fileId),
    {headers:{'X-Client-Portal':token},cache:'no-store'});
   if(!response.ok)throw Error('Acesso à evidência não autorizado.');
   const url=URL.createObjectURL(await response.blob());
   const link=document.createElement('a');link.href=url;link.download=name||'evidencia';
   link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(e){notice.textContent=e.message;}
 }
 $('#refresh').addEventListener('click',tickets);
 $('#capture-location').addEventListener('click',()=>{
  if(!navigator.geolocation){$('#location-state').textContent='Seu navegador não oferece geolocalização.';return;}
  $('#location-state').textContent='Solicitando permissão...';
  navigator.geolocation.getCurrentPosition(pos=>{
   state.location={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
   $('#location-state').textContent='Localização autorizada e vinculada ao próximo chamado.';
  },()=>{state.location=null;$('#location-state').textContent='Localização não enviada.';},
  {enableHighAccuracy:true,timeout:12000,maximumAge:0});
 });
 function dataUrl(file){return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
  reader.onerror=()=>reject(Error('Não foi possível ler a evidência.'));
  reader.readAsDataURL(file);
 });}
 $('#ticket-form').addEventListener('submit',async e=>{
  e.preventDefault();notice.textContent='Enviando chamado...';
  const button=$('#submit-ticket');button.disabled=true;
  try{
   const form=e.currentTarget;
   const files=Array.from($('#evidence').files||[]);
   if(files.length>2)throw Error('Selecione no máximo duas evidências.');
   const evidencias=[];
   for(const file of files){
    if(file.size>500000)throw Error('Cada evidência deve ter até 500 KB.');
    if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))
     throw Error('Anexe apenas imagem JPEG/PNG/WebP ou PDF.');
    evidencias.push({name:file.name,mime:file.type,data:await dataUrl(file)});
   }
   const response=await api('customer/tickets','POST',{
    tipo:form.elements.tipo.value,localEquipamento:form.elements.localEquipamento.value,
    descricao:form.elements.descricao.value,equipamento:form.elements.equipamento.value,
    tecnicoId:form.elements.tecnicoId.value,localizacao:state.location,evidencias
   });
   notice.textContent='Chamado aberto com sucesso! O técnico escolhido e o administrador serão avisados dentro do app.';
   form.reset();state.location=null;$('#location-state').textContent='Localização não enviada.';
   await tickets();
  }catch(err){notice.textContent=err.message;}finally{button.disabled=false;}
 });
 if(!/^[A-Za-z0-9_-]{43}$/.test(token)){
  $('#company').textContent='Acesso não autorizado.';
  $('#ticket-form').hidden=true;$('#tickets').textContent='Peça ao administrador um novo link de acesso.';
 }else{load().catch(err=>{
  $('#company').textContent='Não foi possível validar este acesso.';
  $('#ticket-form').hidden=true;$('#tickets').textContent=err.message;
 });}
})();
