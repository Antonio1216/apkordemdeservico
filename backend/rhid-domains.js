'use strict';
// RHiD: discover authorized customers without exposing JWTs or credentials.
const crypto=require('node:crypto');
const ENDPOINT='https://www.rhid.com.br/v2/api.svc/login';
const cache=new Map();
const valid=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\r\n\u0000]/.test(value);
async function listDomains({email=process.env.RHID_LOGIN_EMAIL,password=process.env.RHID_LOGIN_PASSWORD,fetcher=fetch}={}){
  if(!valid(email,254)||!valid(password,300))throw Error('Credenciais RHiD não configuradas.');
  const key=crypto.createHash('sha256').update(email+'\0'+password).digest('hex');
  const cached=cache.get(key);
  if(cached&&cached.until>Date.now())return cached.domains.map(d=>({...d}));
  const response=await fetcher(ENDPOINT,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({email,password,system:'rhid'})
  });
  if(!response.ok)throw Error('Falha ao autenticar na descoberta dos domínios (HTTP '+response.status+').');
  const raw=await response.text();
  if(raw.length>150000)throw Error('Resposta RHiD acima do tamanho permitido.');
  const parsed=JSON.parse(raw);
  const data=parsed?.accessToken?parsed:parsed?.['application/json']||parsed;
  if(data?.expiredPassword)throw Error('Senha do RHiD expirada.');
  if(!valid(data?.accessToken,8192))throw Error('Login RHiD sem accessToken válido.');
  if(!Array.isArray(data?.listCustomer))throw Error('Login RHiD não retornou listCustomer; solicite ao suporte o fluxo de seleção do domínio.');
  if(data.listCustomer.length>1000)throw Error('Quantidade de domínios acima do limite.');
  const seen=new Set(),domains=[];
  for(const item of data.listCustomer){
    if(!item||typeof item!=='object')continue;
    const domain=typeof item.domain==='string'?item.domain.trim().toLowerCase():'';
    if(!/^[a-z0-9][a-z0-9._-]{0,159}$/.test(domain)||seen.has(domain))continue;
    seen.add(domain);
    const name=typeof item.name==='string'?item.name.trim().slice(0,160):'';
    domains.push({domain,name:name||domain,...(Number.isSafeInteger(item.id)?{id:item.id}:{})});
  }
  domains.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  if(cache.size>100)cache.clear();
  // Only customer metadata is kept briefly; the discovery JWT is discarded.
  cache.set(key,{until:Date.now()+60000,domains});
  return domains.map(d=>({...d}));
}
module.exports={listDomains};
