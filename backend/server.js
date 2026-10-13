'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {URL} = require('node:url');
const {makePdf} = require('./pdf');
const {teamApi} = require('./team-api');
const PORT = +(process.env.PORT || 3000);
const KEY = process.env.ADMIN_KEY || '';
const BASE = String(process.env.PUBLIC_BASE_URL||'').replace(/\/+$/,'');
const DBFILE = process.env.DATA_FILE || path.join(__dirname,'data','requests.json');
const PDFDIR = process.env.PDF_DIR || path.join(path.dirname(DBFILE),'pdf-clientes');
const team = teamApi({key:KEY,dbfile:process.env.TEAM_DATA_FILE||path.join(path.dirname(DBFILE),'team.json')});
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
if (KEY.length < 24) {console.error('Defina ADMIN_KEY com pelo menos 24 caracteres fortes.');process.exit(1);}
if (!/^https:\/\//.test(BASE) && !/^http:\/\/localhost(?::\d+)?$/.test(BASE) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(BASE)) { console.error('Defina PUBLIC_BASE_URL HTTPS público (ou localhost apenas para teste).');process.exit(1); }
let records = {};
try { records = JSON.parse(fs.readFileSync(DBFILE,'utf8')); } catch(e) {if(e.code!=='ENOENT')throw e;}
let writeQueue = Promise.resolve();
function persist(){const text=JSON.stringify(records);writeQueue=writeQueue.catch(()=>{}).then(async()=>{await fs.promises.mkdir(path.dirname(DBFILE),{recursive:true});const file=DBFILE+'.'+process.pid+'.tmp';await fs.promises.writeFile(file,text,{mode:0o600});await fs.promises.rename(file,DBFILE);});return writeQueue;}
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function authorised(req,right=null){
  const actor=team.getActor(req);
  // Sessões autenticadas respeitam permissões mesmo se o aparelho ainda guarda ADMIN_KEY.
  if(actor)return !right||team.hasPermission(req,right);
  const supplied=String(req.headers['x-api-key']||'');
  const a=Buffer.from(hash(supplied),'hex'),b=Buffer.from(hash(KEY),'hex');
  return crypto.timingSafeEqual(a,b);
}
function headers(res,code,extra={}){res.writeHead(code,{'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",...extra});}
function cors(req,res){const origin=String(req.headers.origin||'');if(origin==='https://appassets.androidplatform.net'||origin==='http://localhost:5500'||origin==='http://127.0.0.1:5500'||origin==='http://localhost:8080'){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-API-Key, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');}}
function json(res,code,obj){headers(res,code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));}
function text(res,code,content,type){headers(res,code,{'Content-Type':type});res.end(content);}
async function getBody(req){let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>850000)throw Object.assign(new Error('Payload muito grande.'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}}
function pdfResponse(res,data,filename,download){headers(res,200,{'Content-Type':'application/pdf','Content-Disposition':`${download?'attachment':'inline'}; filename="${filename}"`,'Content-Length':String(data.length)});res.end(data);}
function validLocation(x){return x&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180?{lat:x.lat,lon:x.lon,accuracy:Number.isFinite(x.accuracy)?Math.min(100000,Math.max(0,x.accuracy)):null}:null;}
function validateString(x,n){return typeof x==='string'&&x.trim().length>=1&&x.length<=n;}
function entryByToken(token){if(!/^[A-Za-z0-9_-]{40,90}$/.test(token))return null;const key=hash(token);return Object.values(records).find(r=>r.tokenHash===key)||null;}
const esc=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signPage=fs.readFileSync(path.join(__dirname,'public','sign.html'),'utf8');
const publicJs=fs.readFileSync(path.join(__dirname,'public','sign.js'),'utf8');
const officialLogo=fs.readFileSync(path.join(__dirname,'public','brand','acr-logo.jpg'));
function receiptByToken(token){if(!/^[A-Za-z0-9_-]{40,90}$/.test(token))return null;const receiptHash=hash(token);return Object.values(records).find(r=>r.pdfReceiptHash===receiptHash&&r.status==='signed')||null;}
const attempts=new Map();
function allowed(req){const ip=req.socket.remoteAddress||'unknown',at=Date.now(),arr=(attempts.get(ip)||[]).filter(x=>x>at-60000);arr.push(at);attempts.set(ip,arr);if(attempts.size>3000)attempts.clear();return arr.length<80;}
const server=http.createServer(async(req,res)=>{
  cors(req,res);
  if(req.method==='OPTIONS'){headers(res,204);return res.end();}
  if(!allowed(req))return json(res,429,{error:'Muitas solicitações. Tente novamente.'});
  try {
    const url=new URL(req.url,'http://localhost');
    const p=url.pathname;
    if(p.startsWith('/api/team/'))return await team.handle(req,res,p);
    if(req.method==='GET'&&p==='/health')return json(res,200,{ok:true,service:'OS Pro assinatura remota'});
    if(req.method==='GET'&&p==='/sign.js')return text(res,200,publicJs,'application/javascript; charset=utf-8');
    if(req.method==='GET'&&p==='/brand/acr-logo.jpg'){headers(res,200,{'Content-Type':'image/jpeg'});return res.end(officialLogo);}
    if(req.method==='GET'&&/^\/s\/[\w-]+$/.test(p)){
      const item=entryByToken(p.split('/').pop());
      if(!item)return json(res,404,{error:'Link inexistente.'});
      if(item.status==='signed')return text(res,410,'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Assinatura concluída | ACR</title><body style="font:18px system-ui;max-width:620px;margin:50px auto;padding:24px;color:#102d4e"><h1>ACR Suporte em T.I</h1><h2>Link de assinatura encerrado</h2><p>Esta ordem de serviço já foi assinada. Por segurança, o link enviado não pode ser utilizado novamente.</p><p>Solicite a cópia do PDF à empresa.</p></body></html>','text/html; charset=utf-8');
      if(item.status==='expired'||Date.now()>Date.parse(item.expiresAt))return json(res,410,{error:'Link expirado.'});
      return text(res,200,signPage,'text/html; charset=utf-8');
    }
    const receipt=p.match(/^\/api\/receipt\/([A-Za-z0-9_-]{40,90})\/document[.]pdf$/);
    if(req.method==='GET'&&receipt){
      const item=receiptByToken(receipt[1]);
      if(!item)return json(res,404,{error:'Comprovante não encontrado.'});
      const file=path.join(PDFDIR,item.id+'.pdf');
      const data=await fs.promises.readFile(file);
      return pdfResponse(res,data,`OS-${item.orderNumber.replace(/[^A-Za-z0-9_-]/g,'_')}-assinada.pdf`,false);
    }
    if(req.method==='POST'&&p==='/api/sign-requests'){
      if(!authorised(req,'links'))return json(res,403,{error:'Sem permissão para gerar links de assinatura.'});
      const body=await getBody(req);
      if(!validateString(body.orderNumber,60)||!validateString(body.clientName,140)||!validateString(body.serviceTitle,180))return json(res,400,{error:'Dados incompletos: OS, cliente e serviço são obrigatórios.'});
      const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('base64url'),date=Date.now();
      const details={};
      const fields={type:70,technician:140,description:2400,diagnosis:2400,execution:2400,materials:1700};
      for(const [field,limit] of Object.entries(fields))details[field]=String(body.details?.[field]||'').slice(0,limit);
      for(const field of ['labor','materialsCost','travel','discount'])details[field]=Math.min(100000000,Math.max(0,Number(body.details?.[field])||0));
      records[id]={id,tokenHash:hash(token),orderNumber:body.orderNumber.trim(),clientName:body.clientName.trim(),serviceTitle:body.serviceTitle.trim(),companyName:String(body.companyName||'OS PRO').slice(0,140),details,summary:String(body.summary||'').slice(0,1500),total:Math.max(0,Math.min(100000000,+body.total||0)),status:'pending',createdAt:new Date(date).toISOString(),expiresAt:new Date(date+SEVEN_DAYS).toISOString(),accessLocation:null,accessedAt:null,signature:null};
      await persist();return json(res,201,{id,url:`${BASE}/s/${token}`,expiresAt:records[id].expiresAt});
    }
    const privatePdf=p.match(/^\/api\/sign-requests\/([0-9a-f-]{36})\/document[.]pdf$/i);
    if(req.method==='GET'&&privatePdf){
      if(!authorised(req,'links'))return json(res,403,{error:'Sem permissão para baixar documento da assinatura.'});
      const item=records[privatePdf[1]];if(!item)return json(res,404,{error:'Ordem não encontrada.'});
      const file=path.join(PDFDIR, item.id+'.pdf');
      let data;if(item.status==='signed')try{data=await fs.promises.readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
      data ||= makePdf(item);
      return pdfResponse(res,data,`OS-${item.orderNumber.replace(/[^A-Za-z0-9_-]/g,'_')}.pdf`,true);
    }
    const priv=p.match(/^\/api\/sign-requests\/([0-9a-f-]{36})$/i);
    if(req.method==='GET'&&priv){if(!authorised(req,'links'))return json(res,403,{error:'Sem permissão para consultar assinaturas por link.'});const item=records[priv[1]];if(!item)return json(res,404,{error:'Assinatura não encontrada.'});return json(res,200,{id:item.id,status:item.status,signature:item.signature,expiresAt:item.expiresAt});}
    const pub=p.match(/^\/api\/public\/([A-Za-z0-9_-]{40,90})(\/(?:sign|location|document[.]pdf))?$/);
    if(pub){const item=entryByToken(pub[1]);if(!item)return json(res,404,{error:'Link inexistente.'});if(item.status==='signed')return json(res,410,{error:'Link de assinatura encerrado: assinatura já registrada.'});if(item.status==='pending'&&Date.now()>Date.parse(item.expiresAt)){item.status='expired';await persist();}
      if(req.method==='GET'&&!pub[2])return json(res,200,{orderNumber:item.orderNumber,clientName:item.clientName,serviceTitle:item.serviceTitle,companyName:item.companyName||'OS PRO',details:item.details||{},summary:item.summary,total:item.total,status:item.status,expiresAt:item.expiresAt,pdfAvailable:true});
      if(req.method==='GET'&&pub[2]==='/document.pdf'){
        if(item.status==='expired')return json(res,410,{error:'Link expirado. Solicite outro documento ao responsável.'});
        const file=path.join(PDFDIR,item.id+'.pdf');
        let data;if(item.status==='signed')try{data=await fs.promises.readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
        data ||= makePdf(item);
        const filename=`OS-${item.orderNumber.replace(/[^A-Za-z0-9_-]/g,'_')}${item.status==='signed'?'-assinada':'-conferencia'}.pdf`;
        return pdfResponse(res,data,filename,item.status==='signed');
      }
      if(req.method==='POST'&&pub[2]==='/location'){
        if(item.status!=='pending')return json(res,409,{error:'Link não disponível.'});
        const body=await getBody(req);const location=validLocation(body.location);
        if(body.consent!==true||!location)return json(res,400,{error:'A localização precisa de autorização do cliente.'});
        item.accessLocation=location;item.accessedAt=new Date().toISOString();
        await persist();return json(res,200,{ok:true,recordedAt:item.accessedAt});
      }
      if(req.method==='POST'&&pub[2]==='/sign'){
        if(item.status!=='pending')return json(res,409,{error:item.status==='signed'?'Este link já foi utilizado.':'Este link expirou.'});
        const body=await getBody(req);
        if(!validateString(body.name,140)||body.accepted!==true||typeof body.image!=='string'||!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(body.image)||body.image.length>650000||body.image.length<100)return json(res,400,{error:'Informe nome, aceite e uma assinatura desenhada válida.'});
        const location=validLocation(body.location)||item.accessLocation||null;
        const signedAt=new Date().toISOString();
        item.signature={name:body.name.trim(),image:body.image,signedAt,location,source:'remote',audit:hash(`${item.id}|${signedAt}|${hash(body.image)}`),imageSha256:hash(body.image),ipHash:hash(KEY+String(req.socket.remoteAddress||'')),userAgent:String(req.headers['user-agent']||'').slice(0,260)};
        item.status='signed';
        // O link de assinatura deixa de funcionar. O PDF usa um recibo separado, impossível de deduzir a partir do link enviado.
        const pdfReceipt=crypto.randomBytes(32).toString('base64url');
        item.pdfReceiptHash=hash(pdfReceipt);
        // Persist an individual signed PDF copy before confirming success to the client.
        const pdf=makePdf(item);
        await fs.promises.mkdir(PDFDIR,{recursive:true,mode:0o700});
        await fs.promises.writeFile(path.join(PDFDIR,item.id+'.pdf'),pdf,{mode:0o600});
        await persist();return json(res,200,{ok:true,signedAt,audit:item.signature.audit,pdfUrl:`/api/receipt/${pdfReceipt}/document.pdf`});
      }
    }
    return json(res,404,{error:'Rota não encontrada.'});
  } catch(err){console.error('API:',err.message);return json(res,err.status||500,{error:err.status?err.message:'Erro interno no servidor.'});}
});
if(require.main===module){server.listen(PORT,()=>console.log(`OS Pro assinaturas em ${BASE} (porta ${PORT})`));}
module.exports={server};
