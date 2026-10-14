'use strict';
/* RHiD Control iD: read-only device inventory; no activation keys or passwords stored. */
const DEFAULT_URL='https://www.rhid.com.br/v2/api.svc/device';
function endpoint(value=DEFAULT_URL){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||
      !['www.rhid.com.br','rhid.com.br'].includes(url.hostname.toLowerCase())||
      !/^\/v2\/api\.svc\/device\/?$/i.test(url.pathname))
    throw Error('Endereço da API RHiD inválido: use HTTPS no domínio oficial rhid.com.br e o caminho /v2/api.svc/device.');
  return url.toString();
}
const clean=(v,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
function normalizedStatus(v){
  const s=clean(v,60).toLowerCase();
  if(['online','on-line','conectado','connected'].includes(s))return 'online';
  if(['offline','off-line','desconectado','disconnected'].includes(s))return 'offline';
  return 'desconhecido'; // Never infer connectivity from an old timestamp alone.
}
function iso(v){
  if(!v||typeof v!=='string'||v.length>70)return '';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'':d.toISOString();
}
function normalize(body){
  const raw=Array.isArray(body)?body:body?.records;
  if(!Array.isArray(raw)||raw.length>3000)throw Error('Formato da lista de dispositivos RHiD não reconhecido.');
  const ids=new Set();
  return raw.map((r,index)=>{
    if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Registro de dispositivo inválido.');
    const id=(typeof r.id==='number'&&Number.isSafeInteger(r.id)||typeof r.id==='string')?String(r.id).slice(0,100):String(index);
    if(ids.has(id))throw Error('IDs de dispositivos duplicados no RHiD.');
    ids.add(id);
    return {id,nome:clean(r.name,180)||'Equipamento '+id,serie:clean(r.serial,120),
      status:normalizedStatus(r.status),statusOriginal:clean(r.status,70),
      versao:clean(r.version,120),empresaRhidId:Number.isSafeInteger(r.linkedCompanyId)?r.linkedCompanyId:null,
      ultimaConexao:iso(r.lastConnectionDate),ultimaSincronizacao:iso(r.lastSyncDate)};
  });
}
// The RHiD token is held in memory ONLY. Credentials remain in Render secrets.
let loginCache=null,loginInFlight=null;
function loginEndpoint(deviceUrl){
  const url=new URL(endpoint(deviceUrl));
  url.pathname='/v2/api.svc/login';
  return url.toString();
}
function loginCacheKey(email,password,domain){
  return require('node:crypto').createHash('sha256')
    .update(email+'\0'+password+'\0'+domain).digest('hex');
}
function tokenExpiry(token){
  // JWT expiration is only a cache hint; server verifies the real signature.
  try{
    const data=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
    const time=Number(data.exp)*1000;
    if(Number.isFinite(time)&&time>Date.now())return Math.min(time-60_000,Date.now()+25*60_000);
  }catch{}
  return Date.now()+4*60_000;
}
function readTextLimited(response,limit){
  const size=Number(response.headers?.get?.('content-length')||0);
  if(size>limit)throw Error('Resposta da API RHiD acima do tamanho permitido.');
  return response.text().then(s=>{
    if(s.length>limit)throw Error('Resposta da API RHiD acima do tamanho permitido.');
    return s;
  });
}
function validText(value,max){
  return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\r\n\u0000]/.test(value);
}
async function obtainLoginToken({email,password,domain,url,fetcher,force=false}){
  if(!validText(email,254)||!validText(password,300)||domain&&!validText(domain,160))
    throw Error('Credenciais de integração RHiD inválidas.');
  const key=loginCacheKey(email,password,domain||'');
  if(!force&&loginCache?.key===key&&loginCache.validUntil>Date.now())return loginCache.token;
  if(!force&&loginInFlight?.key===key)return loginInFlight.promise;
  const task=(async()=>{
    const response=await fetcher(loginEndpoint(url),{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(9000),
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({email,password,...(domain?{domain}:{}),system:'rhid'})});
    if(!response.ok)throw Error('O RHiD recusou o login da integração. Confira usuário, senha, domínio e permissão.');
    const raw=await readTextLimited(response,100_000);
    const data=JSON.parse(raw);
    const result=data?.accessToken?data:data?.['application/json'];
    const token=result?.accessToken;
    if(!validText(token,8192)||/\s/.test(token))
      throw Error('O RHiD não retornou um accessToken válido.');
    if(result.expiredPassword===true)throw Error('A senha do RHiD está expirada; atualize-a antes de integrar.');
    loginCache={key,token,validUntil:tokenExpiry(token)};
    return token;
  })();
  loginInFlight={key,promise:task};
  try{return await task;}finally{if(loginInFlight?.promise===task)loginInFlight=null;}
}
async function readDevices({
  token=process.env.RHID_API_TOKEN,
  email=process.env.RHID_LOGIN_EMAIL,
  password=process.env.RHID_LOGIN_PASSWORD,
  domain=process.env.RHID_LOGIN_DOMAIN||'',
  url=process.env.RHID_DEVICE_URL||DEFAULT_URL,
  fetcher=fetch
}={}){
  // Validate URL before sending credentials or tokens, including configured overrides.
  const deviceUrl=endpoint(url);
  const hasLogin=Boolean(email&&password);
  if(!hasLogin&&(!token||typeof token!=='string'||!token.trim()))return {configured:false,devices:[]};
  let accessToken;
  if(hasLogin){
    accessToken=await obtainLoginToken({email,password,domain,url:deviceUrl,fetcher});
  }else{
    if(!validText(token,8192)||/\s/.test(token))throw Error('Token RHiD inválido.');
    accessToken=token.trim();
  }
  const getDevices=credential=>fetcher(deviceUrl,{
    method:'GET',redirect:'error',headers:{Authorization:'Bearer '+credential,Accept:'application/json'},
    signal:AbortSignal.timeout(9000)});
  let response=await getDevices(accessToken);
  if(response.status===401&&hasLogin){
    // Token expired or rejected: renew via POST /login once, then retry GET /device.
    if(loginCache?.token===accessToken)loginCache=null;
    accessToken=await obtainLoginToken({email,password,domain,url:deviceUrl,fetcher,force:true});
    response=await getDevices(accessToken);
  }
  if(!response.ok){
    if(response.status===401||response.status===403)
      throw Object.assign(Error('Acesso ao RHiD recusado: token expirado ou usuário sem permissão para listar equipamentos.'),{status:502});
    throw Object.assign(Error('Não foi possível consultar os equipamentos RHiD (HTTP '+response.status+').'),{status:502});
  }
  const contentType=response.headers?.get?.('content-type')||'';
  if(!contentType.includes('json'))throw Error('Resposta da API RHiD não é JSON.');
  return {configured:true,devices:normalize(JSON.parse(await readTextLimited(response,2_000_000)))};
}

function associate(devices,equipments,companies){
  const bySerial=new Map();
  for(const e of equipments){
    if(!e.serie||!e.empresaId)continue;
    const key=e.serie.trim().toLowerCase();if(!bySerial.has(key))bySerial.set(key,e);
  }
  const byCompany=new Map(companies.map(c=>[c.id,c.nome||c.razaoSocial||'Empresa cadastrada']));
  return devices.map(device=>{
    const match=device.serie?bySerial.get(device.serie.toLowerCase()):null;
    return {...device,empresaId:match?.empresaId||'',empresa:byCompany.get(match?.empresaId)||'Não vinculada',
      patrimonioId:match?.id||''};
  });
}
function summary(devices){
  return {total:devices.length,online:devices.filter(x=>x.status==='online').length,
    offline:devices.filter(x=>x.status==='offline').length,
    unknown:devices.filter(x=>x.status==='desconhecido').length};
}
module.exports={readDevices,normalize,associate,summary,endpoint,DEFAULT_URL};
