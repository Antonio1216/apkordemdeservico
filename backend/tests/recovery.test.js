'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const Recovery=require('../recovery');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'acr-recovery-'));
const port=28000+Math.floor(Math.random()*12000),base='http://127.0.0.1:'+port;
const key='admin-recovery-test-key-'+('z'.repeat(48));
const proc=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),
 env:{...process.env,PORT:String(port),PUBLIC_BASE_URL:base,ADMIN_KEY:key,RESEND_API_KEY:'',PASSWORD_RESET_FROM_EMAIL:'',
 DATA_FILE:path.join(folder,'requests.json'),TEAM_DATA_FILE:path.join(folder,'team.json')},stdio:'ignore'});
after(()=>{proc.kill();fs.rmSync(folder,{recursive:true,force:true});});
async function ready(){for(let i=0;i<150;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,35));}throw Error('server unavailable');}
async function api(p,data,token='',adminKey=''){
 const r=await fetch(base+'/api/team/'+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(adminKey?{'X-API-Key':adminKey}:{})},body:JSON.stringify(data)});
 return {status:r.status,data:await r.json()};
}
async function get(p,token=''){
 const r=await fetch(base+p,{headers:token?{Authorization:'Bearer '+token}:{}});
 return {status:r.status,data:r.status===200?await r.text():''};
}
test('TOTP RFC6238 base32 and encryption roundtrip',()=>{
 assert.equal(Recovery.base32(Buffer.from('12345678901234567890')),'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
 assert.equal(Recovery.totpAt(Recovery.base32(Buffer.from('12345678901234567890')),Math.floor(59/30)),'287082');
 const secret=Recovery.base32(crypto.randomBytes(20));
 const encrypted=Recovery.encrypt(secret,key);
 assert.ok(!encrypted.includes(secret));assert.equal(Recovery.decrypt(encrypted,key),secret);
 assert.throws(()=>Recovery.decrypt(encrypted,'wrongkey'));
 const counter=Math.floor(Date.now()/30000);
 assert.equal(Recovery.verifyTotp(secret,Recovery.totpAt(secret,counter)),counter);
 assert.equal(Recovery.verifyTotp(secret,Recovery.totpAt(secret,counter),Date.now(),counter),-1);
});
test('admin Microsoft Authenticator is opt-in, cannot be enrolled by technicians, and replays fail',async()=>{
 await ready();
 assert.equal((await get('/password-reset')).status,200);
 assert.equal((await get('/password-reset.js')).status,200);
 let r=await api('bootstrap',{nome:'Gestor Principal',login:'admin@acr.test',senha:'SenhaInicial123'},'',key);
 assert.equal(r.status,201);
 const admin=r.data.token;
 r=await api('users',{nome:'Pessoa Técnica',login:'tecnico',email:'tecnico@empresa.test',perfil:'Técnico',senha:'senhaInicial123'},admin);
 assert.equal(r.status,200);assert.equal(r.data.user.email,'tecnico@empresa.test');
 const tech=(await api('login',{login:'tecnico',senha:'senhaInicial123'})).data.token;
 assert.equal((await api('admin-totp/setup',{senha:'senhaInicial123'},tech)).status,403);
 assert.equal((await api('admin-totp/setup',{senha:'errada'},admin)).status,403);
 assert.equal((await api('admin-totp/recover',{login:'admin@acr.test',code:'123456',senha:'OutraSenha-Forte123'})).status,403);
 r=await api('admin-totp/setup',{senha:'SenhaInicial123'},admin);
 assert.equal(r.status,200);assert.ok(/^otpauth:\/\/totp\//.test(r.data.otpauth));
 const secret=r.data.secret;const code=Recovery.totpAt(secret,Math.floor(Date.now()/30000));
 r=await api('admin-totp/confirm',{code},admin);assert.equal(r.status,200);
 const persisted=JSON.parse(fs.readFileSync(path.join(folder,'team.json'),'utf8'));
 const acct=persisted.accounts.find(x=>x.login==='admin@acr.test');
 assert.ok(acct.totp.secret);assert.ok(!JSON.stringify(persisted).includes(secret));
 assert.equal((await api('admin-totp/confirm',{code},admin)).status,409);
 assert.equal((await api('admin-totp/recover',{login:'admin@acr.test',code,senha:'OutraSenha-Forte123'})).status,403); // replay
 const nextCode=Recovery.totpAt(secret,Math.floor(Date.now()/30000)+1);
 assert.equal((await api('admin-totp/recover',{login:'admin@acr.test',code:nextCode,senha:'OutraSenha-Forte123'})).status,200);
 assert.equal((await get('/api/team/me',admin)).status,401);
 assert.equal((await api('login',{login:'admin@acr.test',senha:'SenhaInicial123'})).status,401);
 assert.equal((await api('login',{login:'admin@acr.test',senha:'OutraSenha-Forte123'})).status,200);
});
test('email recovery excludes admin, prevents account enumeration without mail configuration',async()=>{
 let r=await api('password-reset/request',{email:'admin@acr.test'});
 assert.equal(r.status,200);
 let u=await api('password-reset/request',{email:'tecnico@empresa.test'});
 assert.equal(u.status,200);assert.equal(r.data.message,u.data.message);
 u=await api('password-reset/request',{email:'unknown@empresa.test'});
 assert.equal(u.status,200);assert.equal(r.data.message,u.data.message);
 const persisted=JSON.parse(fs.readFileSync(path.join(folder,'team.json'),'utf8'));
 assert.equal(persisted.accounts.filter(x=>x.emailReset).length,0);
 assert.equal((await api('password-reset/confirm',{token:'x'.repeat(43),senha:'OutraSenhaForte123'})).status,400);
 assert.equal((await api('login',{login:'tecnico',senha:'senhaInicial123'})).status,200);
});
