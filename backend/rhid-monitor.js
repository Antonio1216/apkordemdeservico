'use strict';
/* RHiD Control iD: read-only device inventory; no activation keys or passwords stored. */
const DEFAULT_URL='https://www.rhid.com.br/v2/api/device';
function endpoint(value=DEFAULT_URL){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||
      !['www.rhid.com.br','rhid.com.br'].includes(url.hostname.toLowerCase())||
      !/^\/v2\/(?:[a-z0-9._-]+\/)*device\/?$/i.test(url.pathname))
    throw Error('Endereço da API RHiD inválido: use HTTPS no domínio oficial rhid.com.br e o caminho /device.');
  return url.toString();
}
const clean=(v,max=160)=>typeof v==='string'?v.trim().slice(0,max):'';
function normalizedStatus(v){
  const s=clean(v,60).toLowerCase();
  if(['online','on-line','conectado','connected','ativo'].includes(s))return 'online';
  if(['offline','off-line','desconectado','disconnected','inativo'].includes(s))return 'offline';
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
async function readDevices({token=process.env.RHID_API_TOKEN,url=process.env.RHID_DEVICE_URL||DEFAULT_URL,fetcher=fetch}={}){
  if(!token||typeof token!=='string'||!token.trim())return {configured:false,devices:[]};
  // Reject malformed tokens and block header injection; do not ever log credential.
  if(token.length>8192||/[\r\n]/.test(token))throw Error('Token RHiD inválido.');
  const response=await fetcher(endpoint(url),{
    method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token.trim(),Accept:'application/json'},
    signal:AbortSignal.timeout(9000)});
  if(!response.ok){
    if(response.status===401||response.status===403)throw Object.assign(Error('Token RHiD inválido ou sem permissão para consultar equipamentos.'),{status:502});
    throw Object.assign(Error('Não foi possível consultar os equipamentos no RHiD (HTTP '+response.status+').'),{status:502});
  }
  // All device metadata must fit in a bounded response.
  const contentType=response.headers?.get?.('content-type')||'';
  if(!contentType.includes('json'))throw Error('Resposta da API RHiD não é JSON.');
  const size=Number(response.headers?.get?.('content-length')||0);
  if(size>2_000_000)throw Error('Resposta RHiD excede 2 MB.');
  const payload=await response.text();
  if(payload.length>2_000_000)throw Error('Resposta RHiD excede 2 MB.');
  return {configured:true,devices:normalize(JSON.parse(payload))};
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
