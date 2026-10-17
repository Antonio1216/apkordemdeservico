'use strict';
// Diagnostico somente leitura da API RHID para administradores com acesso ao Render Shell.
// NUNCA grava tokens/senhas, e NUNCA imprime payloads que podem conter dados pessoais.
const ALLOWED='https://www.rhid.com.br/v2/api.svc/';
const email=process.env.RHID_LOGIN_EMAIL;
const password=process.env.RHID_LOGIN_PASSWORD;
const domains=process.argv.slice(2);
async function main(){
  if(!email||!password){console.log('CREDENCIAIS: nao configuradas no Render.');process.exitCode=1;return;}
  if(domains.length!==1||!(/^[a-z0-9][a-z0-9._-]{0,159}$/).test(domains[0])){
    console.log('Uso: node ops/diagnosticar-rhid.js DOMINIO');process.exitCode=1;return;
  }
  const domain=domains[0];
  console.log('DOMINIO:',domain);
  let login;
  try{
    login=await fetch(ALLOWED+'login',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({email,password,domain,system:'rhid'})
    });
  }catch(err){console.log('LOGIN: erro de transporte ('+(err.name||'desconhecido')+')');process.exitCode=1;return;}
  console.log('POST /login: HTTP',login.status);
  if(!login.ok){await login.body?.cancel();return;}
  let json;
  try{json=await login.json();}catch{console.log('LOGIN: resposta nao e JSON');return;}
  const result=json?.accessToken?json:json?.['application/json'];
  if(result?.expiredPassword===true){console.log('LOGIN: senha expirada');return;}
  const token=result?.accessToken;
  if(typeof token!=='string'||token.length<1||token.length>8192){
    console.log('LOGIN: token ausente ou formato desconhecido');return;
  }
  for(const route of ['company','device']){
    try{
      const response=await fetch(ALLOWED+route,{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Bearer '+token,Accept:'application/json'}
      });
      console.log('GET /'+route+': HTTP',response.status);
      await response.body?.cancel();
    }catch(err){console.log('GET /'+route+': erro de transporte ('+(err.name||'desconhecido')+')');}
  }
  console.log('Diagnostico finalizado. Nenhum token ou resposta foi exibido.');
}
main().catch(()=>{console.log('Nao foi possivel concluir o diagnostico.');process.exitCode=1;});
