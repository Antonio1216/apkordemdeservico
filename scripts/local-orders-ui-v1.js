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
  section.append(form,refresh,message,list);container.append(section);
  const api=globalThis.ACRLocalOrders;
  const values=()=>({title:fields.title.value,client:fields.client.value,description:fields.description.value,status:status.value});
  function reset(){editing=null;form.reset();submit.textContent='Salvar OS local';cancel.hidden=true}
  cancel.addEventListener('click',reset);
  async function reload(){
   const records=await api.list();list.replaceChildren();
   for(const record of records){
    const item=make('li',record.title+' — '+record.client+' — '+record.status+' ');
    const edit=make('button','Editar');edit.type='button';
    edit.addEventListener('click',()=>{
     editing=record.id;for(const key of ['title','client','description'])fields[key].value=record[key]||'';
     status.value=record.status;submit.textContent='Atualizar OS local';cancel.hidden=false;fields.title.focus();
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
