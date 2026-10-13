(()=>{'use strict';
const token=location.pathname.split('/').pop(),base='/api/public/'+encodeURIComponent(token);const $=id=>document.getElementById(id);
const cvs=$('canvas'),ctx=cvs.getContext('2d');let drew=false,down=false,last=null,already=false,geoLocation=null,requested=false;
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n||0);
function resize(){const old=cvs.width?cvs.toDataURL():'';const box=cvs.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,3);cvs.width=Math.round(box.width*d);cvs.height=Math.round(box.height*d);ctx.setTransform(d,0,0,d,0,0);ctx.strokeStyle='#102d4e';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';if(old){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,box.width,box.height);img.src=old;}}
const point=e=>{const r=cvs.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
cvs.addEventListener('pointerdown',e=>{if(already)return;e.preventDefault();cvs.setPointerCapture(e.pointerId);down=true;last=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(last.x+.1,last.y+.1);ctx.stroke();drew=true;valid();});
cvs.addEventListener('pointermove',e=>{if(!down)return;e.preventDefault();const p=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;});
['pointerup','pointercancel','lostpointercapture'].forEach(t=>cvs.addEventListener(t,()=>down=false));
function valid(){$('send').disabled=already||!drew||!$('agree').checked||!$('name').value.trim();}
$('agree').onchange=valid;$('name').oninput=valid;$('clear').onclick=()=>{ctx.clearRect(0,0,cvs.width,cvs.height);drew=false;valid();};
function addRow(label,value){const p=document.createElement('p');p.className='table-row';const b=document.createElement('strong');b.textContent=label+': ';p.append(b,document.createTextNode(String(value)));$('summary').append(p);}
async function locate(){
  if(requested)return;requested=true;
  if(!navigator.geolocation){$('geo-message').textContent='O navegador não disponibilizou geolocalização.';requested=false;return;}
  $('geo-message').textContent='O navegador solicitará sua permissão para acessar a localização...';
  try{
    const coords=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy}),reject,{enableHighAccuracy:true,timeout:12000,maximumAge:0}));
    geoLocation=coords;
    const r=await fetch(base+'/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,location:coords})});
    if(!r.ok)throw Error('Localização obtida, mas não foi possível registrar no servidor.');
    $('geo-message').textContent='✅ Localização autorizada e registrada para esta OS.';
    $('retry-location').hidden=true;
  }catch(err){$('geo-message').textContent=err.code===1?'Localização não autorizada. Você poderá assinar sem ela ou tentar novamente.':'Não foi possível registrar a localização. Toque em Autorizar localização para tentar novamente.';}
  requested=false;
}
$('retry-location').onclick=locate;
const pdfUrl=base+'/document.pdf';
function setDownload(){ $('download-pdf').href=pdfUrl; }
async function load(){
  try{
    const res=await fetch(base,{cache:'no-store'}),item=await res.json();if(!res.ok)throw Error(item.error||'Link inválido');
    $('summary').replaceChildren();
    addRow('Empresa',item.companyName||'OS PRO');addRow('OS',item.orderNumber);addRow('Cliente',item.clientName);addRow('Serviço',item.serviceTitle);
    const fields=[['Tipo',item.details?.type],['Responsável técnico',item.details?.technician],['Descrição',item.details?.description||item.summary],['Diagnóstico',item.details?.diagnosis],['Execução',item.details?.execution],['Materiais',item.details?.materials]];
    for(const [label,value] of fields)if(value)addRow(label,value);
    addRow('Valor total',money(item.total));addRow('Validade do link',new Date(item.expiresAt).toLocaleString('pt-BR'));
    $('preview-pdf').href=pdfUrl;$('preview-pdf').hidden=false;setDownload();
    if(item.status==='signed'){already=true;document.body.classList.add('signed');$('formbox-sign').style.display='none';$('geobox').style.display='none';return;}
    if(item.status!=='pending'){already=true;$('geobox').style.display='none';$('formbox-sign').style.display='none';$('status').textContent='Este link expirou.';return;}
    $('name').value=item.clientName;valid();
    // Browsers only supply coordinates after the visitor grants permission.
    await locate();
  }catch(e){$('summary').textContent=e.message;$('geobox').style.display='none';$('formbox-sign').style.display='none';}
}
function signatureImage(){const out=document.createElement('canvas');out.width=cvs.width;out.height=cvs.height;const c=out.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,out.width,out.height);c.drawImage(cvs,0,0);return out.toDataURL('image/jpeg',.88);}
$('send').onclick=async()=>{
  if($('send').disabled)return;already=true;valid();$('status').textContent='Salvando assinatura e criando PDF...';
  try{
    const res=await fetch(base+'/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('name').value.trim(),accepted:true,image:signatureImage(),location:geoLocation})});
    const body=await res.json();if(!res.ok)throw Error(body.error||'Falha ao assinar');
    document.body.classList.add('signed');$('formbox-sign').style.display='none';$('geobox').style.display='none';setDownload();
    // The client actively chooses where to save the file using this button.
    $('done').scrollIntoView({behavior:'smooth'});
  }catch(err){already=false;valid();$('status').textContent=err.message;}
};
window.addEventListener('resize',resize);resize();load();
})();
