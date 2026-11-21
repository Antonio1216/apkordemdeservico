/* Formulário independente de OS local; não interfere no formulário legado. */
(() => {
 'use strict';
 const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e};
 function mount(container) {
  if(container.querySelector('#acr-local-orders'))return;
  const section=make('section');section.id='acr-local-orders';
  section.style.cssText='margin-top:18px;padding-top:12px;border-top:1px solid #b7c6d8';
  section.append(make('h3','Ordens de serviço locais'));
  section.append(make('p','Cadastro experimental separado das ordens do aplicativo antigo.'));
  const form=make('form'),fields={};
  for(const [key,label] of [['title','Título'],['client','Cliente'],['description','Descrição']]){
   const wrap=make('label',label),input=make(key==='description'?'textarea':'input');
   input.name=key;input.required=key!=='description';input.style.cssText='display:block;width:100%;box-sizing:border-box;padding:8px;margin:5px 0 12px';
   wrap.style.display='block';wrap.append(input);form.append(wrap);fields[key]=input;
  }
  const statusLabel=make('label','Status'),status=make('select');
  for(const [value,label] of [['aberta','Aberta'],['em_andamento','Em andamento'],['concluida','Concluída']]){
   const option=make('option',label);option.value=value;status.append(option);
  }
  statusLabel.append(status);form.append(statusLabel);
  const submit=make('button','Salvar OS local');submit.type='submit';form.append(submit);
  const cancel=make('button','Cancelar edição');cancel.type='button';cancel.hidden=true;form.append(cancel);
  const refresh=make('button','Atualizar lista');refresh.type='button';
  const message=make('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  const list=make('ul');let editing=null;

  // Evidências vinculadas à OS: no máximo quatro imagens, cada uma com GPS e horário.
  const evidence=make('section');evidence.hidden=true;
  evidence.append(make('h4','Fotos da OS (até 4)'));
  const photoInput=make('input');photoInput.type='file';photoInput.accept='image/*';photoInput.setAttribute('aria-label','Adicionar foto da OS');
  const photoMessage=make('p');photoMessage.setAttribute('role','status');
  const gallery=make('div');evidence.append(photoInput,photoMessage,gallery);
  const dbOpen=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('acr-os-evidencias',1);req.onupgradeneeded=()=>req.result.createObjectStore('fotos',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  async function photos(){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('fotos','readonly');const req=tx.objectStore('fotos').getAll();req.onsuccess=()=>{db.close();resolve(req.result.filter(p=>p.os===editing))};req.onerror=()=>{db.close();reject(req.error)}})}
  async function storePhoto(record,remove=false){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('fotos','readwrite');tx.objectStore('fotos')[remove?'delete':'put'](remove?record.id:record);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
  function position(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>resolve(null),{enableHighAccuracy:true,timeout:10000})})}
  function resize(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',0.7))};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Foto inválida'))};img.src=url})}
  async function showPhotos(){gallery.replaceChildren();if(!editing)return;const items=await photos();photoInput.disabled=items.length>=4;photoMessage.textContent=items.length+'/4 fotos';for(const p of items){const wrap=make('div'),img=make('img');img.src=p.image;img.alt='Foto da ordem de serviço';img.style.cssText='max-width:160px;display:block';const gps=p.gps?p.gps.latitude.toFixed(6)+', '+p.gps.longitude.toFixed(6):'GPS indisponível';const details=make('p',new Date(p.date).toLocaleString('pt-BR')+' | '+gps);const del=make('button','Excluir foto');del.type='button';del.onclick=async()=>{await storePhoto(p,true);await showPhotos()};wrap.append(img,details,del);gallery.append(wrap)}}
  photoInput.addEventListener('change',async()=>{const file=photoInput.files?.[0];photoInput.value='';if(!file||!editing)return;try{if(!file.type.startsWith('image/'))throw Error('Arquivo não é uma imagem');if((await photos()).length>=4)throw Error('Limite de 4 fotos');photoMessage.textContent='Salvando foto...';const image=await resize(file),gps=await position();await storePhoto({id:crypto.randomUUID(),os:editing,image,gps,date:new Date().toISOString()});await showPhotos()}catch(error){photoMessage.textContent=error.message||'Falha ao salvar foto'}});
  section.append(form,evidence,refresh,message,list);container.append(section);
  const api=globalThis.ACRLocalOrders;
  const values=()=>({title:fields.title.value,client:fields.client.value,description:fields.description.value,status:status.value});
  function reset(){editing=null;form.reset();submit.textContent='Salvar OS local';cancel.hidden=true;evidence.hidden=true}
  cancel.addEventListener('click',reset);
  async function reload(){
   const records=await api.list();list.replaceChildren();
   for(const record of records){
    const item=make('li',record.title+' — '+record.client+' — '+record.status+' ');
    const edit=make('button','Editar');edit.type='button';
    edit.addEventListener('click',()=>{
     editing=record.id;for(const key of ['title','client','description'])fields[key].value=record[key]||'';
     status.value=record.status;submit.textContent='Atualizar OS local';cancel.hidden=false;evidence.hidden=false;showPhotos().catch(e=>{photoMessage.textContent=e.message});fields.title.focus();
    });
    item.append(edit);list.append(item);
   }
   message.textContent=records.length+' ordem(ns) local(is).';
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();submit.disabled=true;
   try{
    if(editing)await api.update(editing,values());else await api.create(values());
    reset();await reload();
   }catch(error){message.textContent=error?.message||'Falha ao salvar OS.'}
   finally{submit.disabled=false}
  });
  refresh.addEventListener('click',()=>reload().catch(error=>{message.textContent=error?.message||'Falha na consulta'}));
  reload().catch(error=>{message.textContent=error?.message||'Falha na consulta'});
 }
 function unmount(){document.getElementById('acr-local-orders')?.remove()}
 Object.defineProperty(globalThis,'ACRLocalOrdersUI',{value:Object.freeze({mount,unmount}),writable:false,configurable:false});
})();
