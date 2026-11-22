/* Financeiro local independente das ordens de serviço. */
(() => {
 'use strict';
 const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 const cents=value=>{const n=Number(value);if(!Number.isFinite(n)||n<=0||Math.round(n*100)!==n*100&&Math.abs(Math.round(n*100)-n*100)>1e-7)throw Error('Informe valor positivo com até duas casas decimais.');return Math.round(n*100)};
 const safeDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00'));
 const api=()=>globalThis.ACRLocalModules;
 async function read(){const w=await api().read('workspace');return {w,items:Array.isArray(w.finance)?w.finance:[]}}
 async function write(change){for(let attempt=0;attempt<3;attempt++){const {w,items}=await read();const next=change(items);try{await api().save('workspace',{...w,finance:next},w.revision);return}catch(e){if(e.status!==409||attempt===2)throw e}}}

 const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const localStamp=iso=>new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'medium'});
 function locationNow(){return new Promise(resolve=>{
  if(!navigator.geolocation){resolve(null);return}
  navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy}),()=>resolve(null),{enableHighAccuracy:true,timeout:12000,maximumAge:0});
 })}
 function receiptHtml(record){
  const r=record.receipt,where=r.location
   ?r.location.latitude.toFixed(6)+', '+r.location.longitude.toFixed(6)+' (precisão aproximada: '+Math.round(r.location.accuracy)+' m)'
   :'Localização indisponível ou não autorizada';
  const row=(label,value)=>'<p><strong>'+label+':</strong> '+escapeHtml(value)+'</p>';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprovante de recebimento</title><style>body{font:16px system-ui,Arial;max-width:720px;margin:36px auto;padding:24px;color:#18334b}h1{color:#145d9d;border-bottom:3px solid #145d9d;padding-bottom:12px}p{line-height:1.5}small{color:#526b80}@media print{body{margin:0;padding:12mm}}</style></head><body><h1>ACR OS Pro — Comprovante de recebimento</h1>'
  +row('Identificador',record.id)+row('Descrição',record.description)+row('Categoria',record.category||'Não informada')
  +row('Valor recebido',money(record.cents))+row('Data do lançamento',record.date.split('-').reverse().join('/'))
  +row('Data e hora do comprovante',localStamp(r.createdAt))+row('Localização (GPS)',where)
  +'<p><strong>Situação:</strong> Recebido</p><small>Comprovante gerado pelo aplicativo a partir de lançamento registrado localmente. Data e hora dependem do relógio do dispositivo; coordenadas dependem da permissão de localização. Não equivale a comprovante bancário ou fiscal.</small></body></html>';
 }
 function downloadReceipt(record){
  const blob=new Blob([receiptHtml(record)],{type:'text/html;charset=utf-8'});
  const filename='comprovante-recebimento-'+record.id+'.html';
  // Android WebView may ignore synthetic downloads for blob: URLs.
  // Offer a visible printable document even when download is unsupported.
  const url=URL.createObjectURL(blob);
  const a=el('a','Abrir comprovante');
  a.href=url;a.target='_blank';a.rel='noopener';
  a.download=filename;
  a.style.cssText='display:inline-block;padding:10px;margin:8px 0;background:#145d9d;color:white;border-radius:6px';
  const host=document.getElementById('acr-local-finance');
  const previous=host?.querySelector('[data-acr-receipt-link]');
  previous?.remove();
  a.dataset.acrReceiptLink='true';
  host?.append(a);
  a.click();
  // Keep the URL available for manual opening if the WebView blocks the click.
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},120000);
 }
 function mount(parent){
  if(document.getElementById('acr-local-finance'))return;
  const section=el('section');section.id='acr-local-finance';section.append(el('h3','Financeiro independente'));
  section.append(el('p','Receitas e despesas locais, sem vínculo com ordens de serviço.'));
  const summary=el('p'),form=el('form'),fields={};
  const definitions=[['date','Data','date'],['type','Tipo','select'],['description','Descrição','text'],['category','Categoria','text'],['amount','Valor (R$)','number'],['status','Situação','select']];
  for(const [name,label,type] of definitions){
   const wrap=el('label',label),input=el(type==='select'?'select':'input');input.name=name;
   if(type!=='select')input.type=type;
   if(name==='date')input.value=new Date().toISOString().slice(0,10);
   if(name==='amount'){input.min='0.01';input.step='0.01'}
   if(name==='description'||name==='amount'||name==='date')input.required=true;
   if(name==='type')for(const [v,t] of [['receita','Receita'],['despesa','Despesa']]){const o=el('option',t);o.value=v;input.append(o)}
   if(name==='status')for(const [v,t] of [['pendente','Pendente'],['pago','Pago/recebido']]){const o=el('option',t);o.value=v;input.append(o)}
   input.style.cssText='display:block;width:100%;box-sizing:border-box;margin:5px 0 12px';
   wrap.style.display='block';wrap.append(input);form.append(wrap);fields[name]=input;
  }
  const save=el('button','Salvar lançamento'),cancel=el('button','Cancelar edição'),message=el('p'),list=el('ul'),refresh=el('button','Atualizar'),exportCsv=el('button','Exportar CSV');
  save.type='submit';cancel.type='button';cancel.hidden=true;refresh.type='button';exportCsv.type='button';
  message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  form.append(save,cancel);section.append(summary,form,refresh,exportCsv,message,list);parent.append(section);
  let editing=null;
  function reset(){editing=null;form.reset();fields.date.value=new Date().toISOString().slice(0,10);save.textContent='Salvar lançamento';cancel.hidden=true}
  cancel.addEventListener('click',reset);
  async function reload(){
   const {items}=await read();list.replaceChildren();
   const paid=items.filter(x=>x.status==='pago'),income=paid.filter(x=>x.type==='receita').reduce((s,x)=>s+x.cents,0),expense=paid.filter(x=>x.type==='despesa').reduce((s,x)=>s+x.cents,0);
   summary.textContent='Recebido: '+money(income)+' | Pago: '+money(expense)+' | Saldo realizado: '+money(income-expense)+' | Pendentes: '+items.filter(x=>x.status==='pendente').length;
   for(const record of [...items].sort((a,b)=>b.date.localeCompare(a.date))){
    const li=el('li',record.date.split('-').reverse().join('/')+' • '+record.type+' • '+record.description+' • '+money(record.cents)+' • '+record.status+' ');
    const edit=el('button','Editar'),remove=el('button','Excluir');edit.type=remove.type='button';
    edit.onclick=()=>{editing=record.id;for(const k of ['date','type','description','category','status'])fields[k].value=record[k]||'';fields.amount.value=(record.cents/100).toFixed(2);save.textContent='Atualizar lançamento';cancel.hidden=false;fields.description.focus()};
    remove.onclick=async()=>{if(!confirm('Excluir este lançamento?'))return;try{await write(a=>a.filter(x=>x.id!==record.id));await reload()}catch(e){message.textContent=e.message}};
    li.append(edit,remove);
    if(record.type==='receita'&&record.status==='pago'){
     const receipt=el('button',record.receipt?'Baixar comprovante':'Gerar comprovante');receipt.type='button';
     receipt.onclick=async()=>{receipt.disabled=true;message.textContent='Preparando comprovante e consultando GPS…';try{
      let saved=record;
      if(!record.receipt){
       const createdAt=new Date().toISOString(),location=await locationNow();
       await write(items=>items.map(x=>x.id===record.id&&x.type==='receita'&&x.status==='pago'?{...x,receipt:x.receipt||{createdAt,location}}:x));
       const fresh=await read();saved=fresh.items.find(x=>x.id===record.id);
      }
      if(!saved?.receipt)throw Error('Recebimento não disponível para comprovante.');
      downloadReceipt(saved);await reload();
     }catch(e){message.textContent=e.message||'Falha ao gerar comprovante.'}finally{receipt.disabled=false}};
     li.append(receipt);
    }
    list.append(li);
   }
   message.textContent=items.length+' lançamento(s) registrado(s).';
  }
  form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{
   const record={id:editing||crypto.randomUUID(),date:fields.date.value,type:fields.type.value,description:fields.description.value.trim(),category:fields.category.value.trim(),cents:cents(fields.amount.value),status:fields.status.value};
   if(editing){const old=(await read()).items.find(x=>x.id===editing);if(old?.receipt&&old.type==='receita'&&old.status==='pago'&&record.type==='receita'&&record.status==='pago')record.receipt=old.receipt;}
   if(!safeDate(record.date)||!record.description)throw Error('Preencha data e descrição válidas.');
   await write(items=>editing?items.map(x=>x.id===editing?record:x):[...items,record]);reset();await reload();
  }catch(e){message.textContent=e.message||'Falha ao salvar.'}finally{save.disabled=false}};
  refresh.onclick=()=>reload().catch(e=>{message.textContent=e.message});
  exportCsv.onclick=async()=>{try{const {items}=await read();const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';const rows=[['Data','Tipo','Descrição','Categoria','Valor (R$)','Situação'],...items.map(x=>[x.date,x.type,x.description,x.category,(x.cents/100).toFixed(2).replace('.',','),x.status])];const csv='\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;a.download='financeiro-acr-local.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){message.textContent=e.message}};
  reload().catch(e=>{message.textContent=e.message});
 }
 function unmount(){document.getElementById('acr-local-finance')?.remove()}
 Object.defineProperty(globalThis,'ACRLocalFinanceUI',{value:Object.freeze({mount,unmount}),configurable:false,writable:false});
})();