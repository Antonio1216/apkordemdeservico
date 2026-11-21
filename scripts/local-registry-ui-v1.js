/* Formulários de clientes e equipamentos separados da interface legada. */
(() => {
 'use strict';
 const configs={
  clients:{title:'Clientes locais',permission:'ordens',fields:[['name','Nome *'],['document','Documento'],['phone','Telefone'],['email','E-mail']]},
  equipments:{title:'Equipamentos locais',permission:'equipamentos',fields:[['name','Nome *'],['type','Tipo *'],['brand','Marca'],['model','Modelo'],['serial','Número de série'],['company','Empresa']]}
 };
 const element=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e};
 function mount(parent){
  if(document.getElementById('acr-local-registry'))return;
  const root=element('section');root.id='acr-local-registry';
  root.style.cssText='margin-top:16px;padding:12px;border-top:1px solid #b6c8d8';
  parent.append(root);
  const session=globalThis.ACRLocalSession,api=globalThis.ACRLocalRegistry;
  for(const [kind,cfg] of Object.entries(configs)){
   if(!session?.hasPermission(cfg.permission))continue;
   const section=element('section'),heading=element('h3',cfg.title),form=element('form');
   section.append(heading,form);
   const inputs={};
   for(const [key,label] of cfg.fields){
    const wrapper=element('label',label),input=element('input');
    input.name=key;input.required=label.includes('*');
    input.style.cssText='display:block;width:100%;box-sizing:border-box;padding:9px;margin:4px 0 10px';
    wrapper.style.display='block';wrapper.append(input);form.append(wrapper);inputs[key]=input;
   }
   const save=element('button','Salvar cadastro'),cancel=element('button','Cancelar edição'),refresh=element('button','Atualizar lista'),message=element('p'),list=element('ul');
   save.type='submit';cancel.type='button';refresh.type='button';cancel.hidden=true;
   message.setAttribute('role','status');message.setAttribute('aria-live','polite');
   form.append(save,cancel);section.append(refresh,message,list);root.append(section);
   let editing=null;
   const reset=()=>{editing=null;form.reset();save.textContent='Salvar cadastro';cancel.hidden=true};
   cancel.addEventListener('click',reset);
   async function reload(){
    const records=await api.list(kind);list.replaceChildren();
    for(const record of records){
     const li=element('li',record.name+(kind==='equipments'?' — '+record.type:'')+' ');
     const edit=element('button','Editar');edit.type='button';
     edit.addEventListener('click',()=>{
      editing=record.id;
      for(const [key] of cfg.fields)inputs[key].value=record[key]||'';
      save.textContent='Atualizar cadastro';cancel.hidden=false;inputs.name.focus();
     });
     li.append(edit);list.append(li);
    }
    message.textContent=records.length+' registro(s) local(is).';
   }
   form.addEventListener('submit',async event=>{
    event.preventDefault();save.disabled=true;
    try{
     const values=Object.fromEntries(cfg.fields.map(([key])=>[key,inputs[key].value]));
     await api.save(kind,values,editing);reset();await reload();
    }catch(error){message.textContent=error?.message||'Não foi possível salvar.'}
    finally{save.disabled=false}
   });
   refresh.addEventListener('click',()=>reload().catch(error=>{message.textContent=error?.message||'Falha ao consultar.'}));
   reload().catch(error=>{message.textContent=error?.message||'Falha ao consultar.'});
  }
 }
 function unmount(){document.getElementById('acr-local-registry')?.remove()}
 Object.defineProperty(globalThis,'ACRLocalRegistryUI',{value:Object.freeze({mount,unmount}),configurable:false,writable:false});
})();
