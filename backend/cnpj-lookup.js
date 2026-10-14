'use strict';
// Serviço de CNPJ: a consulta é feita exclusivamente ao domínio fixo da BrasilAPI.
// O frontend nunca recebe dados de sócios/CPF retornados pela fonte pública.
function normalizeCnpj(value){
  return String(value||'').toUpperCase().replace(/[.\/\-\s]/g,'');
}
function validCnpj(value){
  const c=normalizeCnpj(value);
  if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(c)||/^([0-9A-Z])\1{13}$/.test(c))return false;
  const values=[...c].map(ch=>ch.charCodeAt(0)-48);
  const check=arr=>{
    let weight=2,total=0;
    for(let i=arr.length-1;i>=0;i--){total+=arr[i]*weight;weight=weight===9?2:weight+1;}
    const mod=total%11;return mod<2?0:11-mod;
  };
  return check(values.slice(0,12))===values[12]&&check(values.slice(0,13))===values[13];
}
const KEYS={
  razaoSocial:180,nomeFantasia:180,logradouro:160,numero:30,complemento:100,
  bairro:120,cidade:120,uf:2,cep:8,situacaoCadastral:100,telefone:24,email:254
};
function details(body={}){
  const output={};
  if(body.cnpj!==undefined){
    const c=normalizeCnpj(body.cnpj);
    if(c&&!validCnpj(c))throw {status:400,message:'CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.'};
    output.cnpj=c;
  }
  for(const [key,max] of Object.entries(KEYS)){
    if(body[key]!==undefined){
      if(typeof body[key]!=='string'||body[key].length>max)
        throw {status:400,message:'Campo inválido: '+key+'.'};
      output[key]=body[key].trim();
    }
  }
  if(output.cep!==undefined){
    output.cep=output.cep.replace(/\D/g,'');
    if(output.cep&&output.cep.length!==8)throw {status:400,message:'CEP inválido.'};
  }
  if(output.uf!==undefined){
    output.uf=output.uf.toUpperCase();
    if(output.uf&&!/^[A-Z]{2}$/.test(output.uf))throw {status:400,message:'UF inválida.'};
  }
  return output;
}
function mappedCnpj(raw){
  return details({
    cnpj:raw.cnpj,
    razaoSocial:String(raw.razao_social||'').slice(0,180),
    nomeFantasia:String(raw.nome_fantasia||'').slice(0,180),
    logradouro:String(raw.logradouro||'').slice(0,160),
    numero:String(raw.numero||'').slice(0,30),
    complemento:String(raw.complemento||'').slice(0,100),
    bairro:String(raw.bairro||'').slice(0,120),
    cidade:String(raw.municipio||'').slice(0,120),
    uf:String(raw.uf||'').slice(0,2),
    cep:String(raw.cep||'').slice(0,8),
    situacaoCadastral:String(raw.descricao_situacao_cadastral||'').slice(0,100),
    telefone:String(raw.ddd_telefone_1||'').slice(0,24),
    email:String(raw.email||'').slice(0,254)
  });
}
async function lookupCnpj(cnpj,fetcher=globalThis.fetch){
  if(!validCnpj(cnpj))throw {status:400,message:'CNPJ inválido. Confira os dados digitados.'};
  let response;
  try{
    response=await fetcher('https://brasilapi.com.br/api/cnpj/v1/'+encodeURIComponent(normalizeCnpj(cnpj)),{
      method:'GET',headers:{'Accept':'application/json'},signal:AbortSignal.timeout(10000)
    });
  }catch{throw {status:503,message:'Não foi possível consultar o CNPJ agora. Você pode preencher os dados manualmente.'};}
  if(response.status===404)throw {status:404,message:'CNPJ não encontrado na base pública. Verifique o número ou preencha manualmente.'};
  if(response.status===429)throw {status:503,message:'Serviço de CNPJ temporariamente limitado. Aguarde ou preencha manualmente.'};
  if(!response.ok)throw {status:503,message:'Serviço de consulta de CNPJ indisponível. Preencha manualmente.'};
  let obj;
  try{
    const size=Number(response.headers?.get('content-length')||0);
    if(size>2_000_000)throw Error('Resposta acima do limite.');
    const raw=await response.text();
    if(raw.length>2_000_000)throw Error('Resposta acima do limite.');
    obj=JSON.parse(raw);
  }catch{throw {status:503,message:'A consulta do CNPJ retornou dados indisponíveis. Preencha manualmente.'};}
  const result=mappedCnpj(obj);
  if(result.cnpj!==normalizeCnpj(cnpj)||!result.razaoSocial)
    throw {status:503,message:'Dados divergentes na consulta do CNPJ. Preencha manualmente.'};
  return result;
}
module.exports={normalizeCnpj,validCnpj,details,mappedCnpj,lookupCnpj};