'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function serviceDesk({data,dbfile,persist,send,body,writeAudit,scopeFor}){
 data.tickets??=[];
 data.clientPortals??={};
 data.ticketSeen??={};
 const uploadDir=path.join(path.dirname(dbfile),'ticket-evidence');
 const validId=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
 const txt=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
 const validText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 const companyExists=id=>data.workspace.clients.some(x=>x.id===id);
 const activeTech=(companyId)=>data.accounts.filter(x=>x.active!==false&&x.perfil==='Técnico'&&x.empresaId===companyId)
    .map(x=>({id:x.id,nome:x.nome}));
 const client=(id)=>data.workspace.clients.find(x=>x.id===id);
 const companyName=x=>String(x?.nome||x?.razaoSocial||'Cliente');
 const outsourcingCompany=id=>client(data.companyLinks?.[id]);
 const currentPortal=req=>{
  const t=req.headers['x-client-portal'];
  if(typeof t!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(t))return null;
  const hash=crypto.createHash('sha256').update(t).digest('hex');
  const item=Object.entries(data.clientPortals).find(([companyId,p])=>companyExists(companyId)&&
    p.hash===hash&&p.expires>Date.now());
  return item?.[0]||null;
 };
 const allowed=(actor,ticket)=>{
  if(actor.perfil==='Administrador')return true;
  if(actor.perfil!=='Técnico')return false;
  const scope=scopeFor(actor);
  return (scope===null||scope===ticket.empresaId)&&ticket.tecnicoId===actor.id;
 };
 const belongs=(actor,ticket)=>{
  if(actor.perfil==='Administrador')return true;
  if(actor.perfil!=='Técnico')return false;
  const scope=scopeFor(actor);
  return (scope===null||scope===ticket.empresaId)&&ticket.tecnicoId===actor.id;
 };
 function safeTicket(t){
  const {empresaId,tecnicoId,...rest}=t;
  return {...rest,empresaId,tecnicoId,evidencias:t.evidencias.map(x=>({id:x.id,nome:x.nome,tipo:x.tipo,tamanho:x.tamanho}))};
 }
 const allowedMime={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf'};
 function decodeAttachment(a){
  if(!a||typeof a!=='object'||typeof a.name!=='string'||a.name.length>100||typeof a.mime!=='string'||!allowedMime[a.mime]||
     typeof a.data!=='string'||a.data.length>740000||!a.data.length||!/^[-_a-zA-Z0-9+/]+=*$/.test(a.data))
    throw Object.assign(Error('Anexo inválido: use imagem ou PDF de até 500 KB.'),{status:400});
  const bin=Buffer.from(a.data,'base64');
  if(bin.length>520000||bin.length<12)throw Object.assign(Error('Anexo excede 500 KB ou está vazio.'),{status:400});
  const prefix=bin.subarray(0,12).toString('hex');
  if(a.mime==='image/jpeg'&&!prefix.startsWith('ffd8ff')||
     a.mime==='image/png'&&!prefix.startsWith('89504e470d0a1a0a')||
     a.mime==='image/webp'&&(bin.subarray(0,4).toString()!=='RIFF'||bin.subarray(8,12).toString()!=='WEBP')||
     a.mime==='application/pdf'&&bin.subarray(0,5).toString()!=='%PDF-')
    throw Object.assign(Error('O formato do arquivo não corresponde ao tipo informado.'),{status:400});
  return {bin,id:crypto.randomUUID(),nome:txt(a.name,100),tipo:a.mime,tamanho:bin.length};
 }
 async function evidence(req,res,ticket,file){
  const e=ticket.evidencias.find(x=>x.id===file);
  if(!e)return send(res,404,{error:'Evidência não encontrada.'});
  try{
   const bin=await fs.promises.readFile(path.join(uploadDir,e.id+allowedMime[e.tipo]));
   res.writeHead(200,{'Content-Type':e.tipo,'Content-Disposition':'attachment; filename="evidencia'+allowedMime[e.tipo]+'"',
     'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':String(bin.length)});
   res.end(bin);
  }catch{return send(res,404,{error:'Arquivo não encontrado.'});}
 }
 async function publicHandle(req,res,p){
  const companyId=currentPortal(req);
  if(!companyId)return send(res,401,{error:'Acesso do cliente inválido ou expirado.'});
  if(req.method==='GET'&&p==='customer/info')
   return send(res,200,{empresa:txt(companyName(client(companyId)),160),
    terceirizada:outsourcingCompany(companyId)?txt(companyName(outsourcingCompany(companyId)),160):null,
    tecnicos:activeTech(companyId)});
  if(req.method==='GET'&&p==='customer/tickets')
   return send(res,200,{tickets:data.tickets.filter(x=>x.empresaId===companyId).map(safeTicket).reverse()});
  const match=p.match(/^customer\/tickets\/([0-9a-f-]{36})\/evidence\/([0-9a-f-]{36})$/i);
  if(req.method==='GET'&&match){
   const ticket=data.tickets.find(x=>x.id===match[1]&&x.empresaId===companyId);
   if(!ticket)return send(res,404,{error:'Chamado não encontrado.'});
   return evidence(req,res,ticket,match[2]);
  }
  if(req.method==='POST'&&p==='customer/tickets'){
   const b=await body(req);
   const lastHour=Date.now()-60*60_000;
   if(data.tickets.length>=10000||data.tickets.filter(x=>x.empresaId===companyId&&Date.parse(x.criadoEm)>lastHour).length>=15)
     return send(res,429,{error:'Limite de chamados atingido. Aguarde um pouco ou fale com o suporte.'});
   if(!validText(b.tipo,90)||!validText(b.localEquipamento,220)||!validText(b.descricao,2400)||
      !validId(b.tecnicoId)||!activeTech(companyId).some(x=>x.id===b.tecnicoId)||
      !Array.isArray(b.evidencias)||b.evidencias.length>2)
     return send(res,400,{error:'Informe problema, local do equipamento e técnico autorizado. Até duas evidências.'});
   const lat=b.localizacao?.lat,lon=b.localizacao?.lon,accuracy=b.localizacao?.accuracy;
   if(b.localizacao!==null&&b.localizacao!==undefined&&
      (!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180))
     return send(res,400,{error:'Coordenadas de localização inválidas.'});
   const list=b.evidencias.map(decodeAttachment),ticketId=crypto.randomUUID(),saved=[];
   try{
    await fs.promises.mkdir(uploadDir,{recursive:true,mode:0o700});
    for(const e of list){
     const target=path.join(uploadDir,e.id+allowedMime[e.tipo]);
     await fs.promises.writeFile(target,e.bin,{flag:'wx',mode:0o600});saved.push(target);
    }
    const now=new Date().toISOString();
    const ticket={id:ticketId,empresaId:companyId,tecnicoId:b.tecnicoId,tipo:txt(b.tipo,90),
      equipamento:txt(b.equipamento,160),localEquipamento:txt(b.localEquipamento,220),
      descricao:txt(b.descricao,2400),localizacao:b.localizacao?
      {lat,lon,accuracy:Number.isFinite(accuracy)?Math.min(100000,Math.max(0,accuracy)):null}:null,
      evidencias:list.map(({id,nome,tipo,tamanho})=>({id,nome,tipo,tamanho})),
      status:'Aberto',criadoEm:now,atualizadoEm:now,createdBy:'Cliente'};
    data.tickets.push(ticket);
    writeAudit('ticket-created',ticketId);
    await persist();return send(res,201,{ticket:safeTicket(ticket)});
   }catch{
    data.tickets=data.tickets.filter(x=>x.id!==ticketId);
    await Promise.all(saved.map(x=>fs.promises.unlink(x).catch(()=>{})));
    return send(res,500,{error:'Não foi possível salvar o chamado. Tente novamente.'});
   }
  }
  return send(res,404,{error:'Rota não encontrada.'});
 }
 async function authenticatedHandle(req,res,p,actor){
  if(req.method==='POST'&&p==='customer-portals'){
   if(actor.perfil!=='Administrador')return send(res,403,{error:'Somente o administrador pode criar acesso de cliente.'});
   const b=await body(req);
   if(typeof b.empresaId!=='string'||b.empresaId.length>100||!companyExists(b.empresaId))return send(res,400,{error:'Selecione uma empresa cadastrada.'});
   if(Object.values(data.companyLinks||{}).includes(b.empresaId))
    return send(res,400,{error:'Selecione o cliente final. O link de chamados não pode pertencer à terceirizada.'});
   const token=crypto.randomBytes(32).toString('base64url');
   data.clientPortals[b.empresaId]={hash:crypto.createHash('sha256').update(token).digest('hex'),
      expires:Date.now()+90*24*3600*1000};
   writeAudit('client-portal-rotate',actor.id);
   await persist();
   const base=String(process.env.PUBLIC_BASE_URL||'').replace(/\/+$/,'');
   return send(res,200,{link:base+'/client-portal#token='+token,expiraEm:new Date(data.clientPortals[b.empresaId].expires).toISOString()});
  }
  if(req.method==='GET'&&p==='tickets'){
   const tickets=data.tickets.filter(x=>belongs(actor,x)).map(safeTicket).reverse();
   const seen=data.ticketSeen[actor.id]||{};
   return send(res,200,{tickets,novos:tickets.filter(x=>!seen[x.id]&&x.status==='Aberto').map(x=>x.id)});
  }
  if(req.method==='POST'&&p==='tickets/seen'){
   const b=await body(req);
   if(!Array.isArray(b.ids)||b.ids.length>100||b.ids.some(x=>!validId(x)))
    return send(res,400,{error:'Lista de chamados inválida.'});
   data.ticketSeen[actor.id]??={};
   for(const id of b.ids){
    const t=data.tickets.find(x=>x.id===id);
    if(t&&belongs(actor,t))data.ticketSeen[actor.id][id]=Date.now();
   }
   await persist();return send(res,200,{ok:true});
  }
  const patch=p.match(/^tickets\/([0-9a-f-]{36})\/status$/i);
  if(req.method==='POST'&&patch){
   const ticket=data.tickets.find(x=>x.id===patch[1]);
   if(!ticket||!allowed(actor,ticket))return send(res,403,{error:'Chamado não disponível para esse usuário.'});
   const b=await body(req);
   if(!['Aberto','Em atendimento','Aguardando cliente','Concluído'].includes(b.status))
    return send(res,400,{error:'Status inválido.'});
   ticket.status=b.status;ticket.atualizadoEm=new Date().toISOString();
   writeAudit('ticket-status',actor.id);
   await persist();return send(res,200,{ticket:safeTicket(ticket)});
  }
  const getEncoded=p.match(/^tickets\/([0-9a-f-]{36})\/evidence-data\/([0-9a-f-]{36})$/i);
  if(req.method==='GET'&&getEncoded){
   const ticket=data.tickets.find(x=>x.id===getEncoded[1]);
   if(!ticket||!belongs(actor,ticket))return send(res,403,{error:'Evidência indisponível.'});
   const e=ticket.evidencias.find(x=>x.id===getEncoded[2]);
   if(!e)return send(res,404,{error:'Arquivo não encontrado.'});
   try{
    const bytes=await fs.promises.readFile(path.join(uploadDir,e.id+allowedMime[e.tipo]));
    return send(res,200,{nome:e.nome,tipo:e.tipo,data:bytes.toString('base64')});
   }catch{return send(res,404,{error:'Arquivo indisponível.'});}
  }
  const getFile=p.match(/^tickets\/([0-9a-f-]{36})\/evidence\/([0-9a-f-]{36})$/i);
  if(req.method==='GET'&&getFile){
   const ticket=data.tickets.find(x=>x.id===getFile[1]);
   if(!ticket||!belongs(actor,ticket))return send(res,403,{error:'Evidência indisponível.'});
   return evidence(req,res,ticket,getFile[2]);
  }
  return send(res,404,{error:'Rota não encontrada.'});
 }
 return {publicHandle,authenticatedHandle};
}
module.exports={serviceDesk};
