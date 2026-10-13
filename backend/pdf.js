'use strict';
// Dependency-free A4 PDF generator for the remote signature portal.
// Produces a readable work order and embeds the client's JPEG signature.
const {Buffer} = require('node:buffer');
const zlib = require('node:zlib');
const W = 595.28, H = 841.89, M = 46;
const safe = s => String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u20ac/g,'EUR').replace(/[^\u0020-\u007e\u00a0-\u00ff]/g,'?');
const enc = s => Buffer.from(safe(s),'latin1');
const cmd = s => Buffer.from(s+'\n','latin1');
const escape = s => safe(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const money = n => `R$ ${Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const when = iso => iso ? new Date(iso).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : 'Nao registrado';

function decodePng(data) {
  if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return null;
  let w=0,h=0,type=-1,depth=0,interlace=0,parts=[];
  for(let p=8;p+12<=data.length;){
    const len=data.readUInt32BE(p),chunk=data.toString('ascii',p+4,p+8);p+=8;
    if(len>data.length-p-4)return null;
    const bytes=data.subarray(p,p+len);p+=len+4;
    if(chunk==='IHDR'){w=bytes.readUInt32BE(0);h=bytes.readUInt32BE(4);depth=bytes[8];type=bytes[9];interlace=bytes[12];}
    else if(chunk==='IDAT')parts.push(bytes);
    else if(chunk==='IEND')break;
  }
  if(!w||!h||w*h>1800000||depth!==8||![2,6].includes(type)||interlace||!parts.length)return null;
  const ch=type===6?4:3,row=w*ch,stride=row+1,raw=zlib.inflateSync(Buffer.concat(parts));
  if(raw.length!==stride*h)return null;
  const rgb=Buffer.alloc(w*h*3),prior=Buffer.alloc(row);let offset=0;
  for(let y=0;y<h;y++){
    const mode=raw[offset++],line=Buffer.alloc(row);
    if(mode>4)return null;
    for(let x=0;x<row;x++){
      const b=raw[offset++],left=x>=ch?line[x-ch]:0,above=prior[x],upleft=x>=ch?prior[x-ch]:0;
      const paeth=()=>{const p=left+above-upleft,a=Math.abs(p-left),b=Math.abs(p-above),c=Math.abs(p-upleft);return a<=b&&a<=c?left:b<=c?above:upleft;};
      line[x]=(b+[0,left,above,Math.floor((left+above)/2),paeth()][mode])&255;
    }
    for(let x=0;x<w;x++){
      const alpha=ch===4?line[x*4+3]:255;
      for(let c=0;c<3;c++)rgb[(y*w+x)*3+c]=Math.round((line[x*ch+c]*alpha + 255*(255-alpha))/255);
    }
    line.copy(prior);
  }
  return {width:w,height:h,bytes:zlib.deflateSync(rgb),filter:'/FlateDecode'};
}

function makePdf(order) {
  const pages=[];let parts=[],y=H-M;
  function newPage(){if(parts.length)pages.push(parts.join(''));parts=[];y=H-M;}
  function writeLine(t,{font='F1',size=10,indent=0,color='0.12 0.20 0.30'}={}){
    if(y<65)newPage();parts.push(`${color} rg BT /${font} ${size} Tf 1 0 0 1 ${M+indent} ${y.toFixed(2)} Tm (${escape(t)}) Tj ET\n`);y-=size+6;
  }
  function wrapped(label,value,{size=10,indent=0}={}){
    const text=`${label ? label+': ' : ''}${safe(value ?? '')}`;
    const max=Math.max(22,Math.floor((W-2*M-indent)/(size*0.54)));
    const words=text.split(/\s+/);let line='';
    for(const word of words){if(line&&`${line} ${word}`.length>max){writeLine(line,{size,indent});line='';}if(word.length>max){if(line){writeLine(line,{size,indent});line='';}for(let pos=0;pos<word.length;pos+=max)writeLine(word.slice(pos,pos+max),{size,indent});}else line+=(line?' ':'')+word;}
    if(line)writeLine(line,{size,indent});
  }
  const section=t=>{y-=6;writeLine(t,{font:'F2',size:13,color:'0.07 0.24 0.42'});};
  writeLine(order.companyName||'OS PRO - ELETRICA E SOFTWARE',{font:'F2',size:15,color:'0.05 0.17 0.31'});
  writeLine('ORDEM DE SERVICO - '+order.orderNumber,{font:'F2',size:13});
  y-=7;
  wrapped('Cliente',order.clientName);wrapped('Servico',order.serviceTitle);
  wrapped('Tipo',order.details?.type||'Nao informado');
  wrapped('Tecnico',order.details?.technician||'Nao informado');
  section('Descrição do atendimento');
  wrapped('Solicitacao',order.details?.description||order.summary||'Nao informada');
  wrapped('Diagnostico',order.details?.diagnosis||'Nao informado');
  wrapped('Execucao',order.details?.execution||order.summary||'Nao informada');
  wrapped('Materiais',order.details?.materials||'Nao informados');
  section('Valores');
  if(order.details?.labor!==undefined)wrapped('Mao de obra',money(order.details.labor));
  if(order.details?.materialsCost!==undefined)wrapped('Materiais',money(order.details.materialsCost));
  if(order.details?.travel!==undefined)wrapped('Deslocamento',money(order.details.travel));
  if(order.details?.discount!==undefined)wrapped('Desconto',money(order.details.discount));
  writeLine('TOTAL: '+money(order.total),{font:'F2',size:12});
  section('Confirmacao da assinatura');
  const signed=order.status==='signed' && order.signature;
  wrapped('Status',signed?'Assinatura eletronica simples registrada':'Documento para conferencia, ainda nao assinado');
  if(signed){
    wrapped('Nome do assinante',order.signature.name);
    wrapped('Data e horario (Brasilia)',when(order.signature.signedAt));
    const loc=order.signature.location;
    wrapped('Localizacao informada pelo aparelho',loc ? `${loc.lat.toFixed(6)}, ${loc.lon.toFixed(6)} (precisao estimada ${Math.round(loc.accuracy||0)} m)`:'Nao autorizada / indisponivel');
    wrapped('Registro de auditoria SHA-256',order.signature.audit,{size:8});
  }else{
    writeLine('Confira este documento antes de prosseguir com a assinatura.',{size:10});
  }
  let signatureImage=null;
  if(signed && /^data:image\/(?:jpeg|png);base64,/.test(order.signature.image||'')){
    const source=order.signature.image,bytes=Buffer.from(source.split(',')[1],'base64');
    if(bytes.length<250000){
      if(source.startsWith('data:image/png')){
        try{signatureImage=decodePng(bytes);}catch{signatureImage=null;}
      }else{
        let width=0,height=0;
        for(let i=2;i<bytes.length-9;i++)if(bytes[i]===0xff&&[0xc0,0xc1,0xc2,0xc3].includes(bytes[i+1])){height=bytes.readUInt16BE(i+5);width=bytes.readUInt16BE(i+7);break;}
        if(width>0&&height>0&&width*height<1800000)signatureImage={width,height,bytes,filter:'/DCTDecode'};
      }
    }
  }
  if(signatureImage){
    if(y<170)newPage();
    y-=85; parts.push(`q 230 0 0 75 ${M} ${y.toFixed(2)} cm /Sig Do Q\n`);
    y-=10;
  }else if(signed){wrapped('Assinatura desenhada','Imagem PNG disponivel no registro digital da OS');}
  y-=10;
  wrapped('Observacao','Esta assinatura simples nao equivale a um certificado digital GOV.BR.',{size:9});
  wrapped('Emissao do PDF',when(new Date().toISOString()),{size:9});
  newPage();
  const objects=[null], add=s=>{objects.push(s);return objects.length-1;};
  const catalog=add('');const pagesObj=add('');
  const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  let imageObj=null;
  if(signatureImage){
    const {width,height,bytes,filter}=signatureImage;
    imageObj=add([`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${bytes.length} >>\nstream\n`,bytes,'\nendstream']);
  }
  const pageIds=[];
  for(const pageText of pages){
    const content=Buffer.from(pageText,'latin1');
    const contentId=add([`<< /Length ${content.length} >>\nstream\n`,content,'\nendstream']);
    const resources=`<< /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> ${imageObj?`/XObject << /Sig ${imageObj} 0 R >>`:''} >>`;
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resources} /Contents ${contentId} 0 R >>`));
  }
  objects[catalog]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`;
  const chunks=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','latin1')], offsets=[0];let pos=chunks[0].length;
  for(let i=1;i<objects.length;i++){
    const pieces=Array.isArray(objects[i])?objects[i]:[objects[i]];
    const bufs=[cmd(`${i} 0 obj`),...pieces.map(p=>Buffer.isBuffer(p)?p:Buffer.from(p,'latin1')),cmd('\nendobj')];
    offsets[i]=pos;for(const b of bufs){chunks.push(b);pos+=b.length;}
  }
  const xref=pos;
  let tail=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let i=1;i<objects.length;i++)tail+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  tail+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  chunks.push(Buffer.from(tail,'latin1'));
  return Buffer.concat(chunks);
}
module.exports={makePdf};
