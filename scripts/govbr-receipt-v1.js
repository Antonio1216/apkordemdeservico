/* ACR OS Pro: importação e compartilhamento de PDF assinado sem alterar seus bytes. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const MAX=15*1024*1024;
const dbOpen=()=>new Promise((resolve,reject)=>{
 const req=indexedDB.open('acr-govbr-receipts',1);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('files'))req.result.createObjectStore('files');};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
async function put(key,value){const db=await dbOpen();return new Promise((resolve,reject)=>{
 const tx=db.transaction('files','readwrite');tx.objectStore('files').put(value,key);
 tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
});}
async function get(key){const db=await dbOpen();return new Promise((resolve,reject)=>{
 const tx=db.transaction('files','readonly');const req=tx.objectStore('files').get(key);
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 tx.oncomplete=()=>db.close();
});}
function download(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
document.addEventListener('DOMContentLoaded',()=>{
 const finance=$('#financeiro');if(!finance||$('#acr-govbr-panel'))return;
 const section=document.createElement('section');section.id='acr-govbr-panel';section.className='panel';
 section.innerHTML='<h2>Comprovante assinado GOV.BR</h2><p class="hint">Gere o recibo no Financeiro, assine no portal oficial e importe o PDF assinado. A assinatura original será preservada.</p><div class="actions"><button type="button" id="acr-govbr-open">Assinar com GOV.BR</button><label class="primary" for="acr-govbr-file" style="display:inline-flex;align-items:center;padding:12px;border-radius:8px;cursor:pointer">Importar PDF assinado</label><input type="file" id="acr-govbr-file" accept="application/pdf,.pdf" hidden><button type="button" id="acr-govbr-share">Compartilhar PDF</button><button type="button" id="acr-govbr-save">Salvar PDF no celular</button></div><p id="acr-govbr-status" role="status" aria-live="polite"></p>';
 finance.append(section);
 const status=$('#acr-govbr-status');
 $('#acr-govbr-open').onclick=()=>window.open('https://assinador.iti.br/','_blank','noopener');
 $('#acr-govbr-file').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>MAX||file.size<8){status.textContent='PDF inválido ou maior que 15 MB.';return;}
  try{
   const bytes=await file.slice(0,5).arrayBuffer();
   if(new TextDecoder().decode(bytes)!=='%PDF-')throw Error('Arquivo não é um PDF.');
   const stored=new File([file],file.name,{type:'application/pdf'});
   await put('latest',{blob:stored,name:file.name,date:new Date().toISOString()});
   status.textContent='PDF importado sem modificações. A validade da assinatura deve ser conferida no VALIDAR/ITI.';
  }catch(err){status.textContent='Falha ao importar PDF: '+err.message;}
 };
 async function storedFile(){const record=await get('latest');if(!record)throw Error('Importe primeiro um PDF assinado.');return new File([record.blob],record.name,{type:'application/pdf'});}
 $('#acr-govbr-save').onclick=async()=>{try{download(await storedFile());}catch(e){status.textContent=e.message;}};
 $('#acr-govbr-share').onclick=async()=>{
  try{
   const file=await storedFile();
   if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Comprovante de recebimento'});}
   else{download(file);status.textContent='O compartilhamento direto não está disponível neste dispositivo. PDF disponibilizado para salvar e anexar no WhatsApp ou e-mail.';}
  }catch(e){if(e.name!=='AbortError')status.textContent='Não foi possível compartilhar: '+e.message;}
 };
});
})();
