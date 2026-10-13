'use strict';
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ospro-test-'));
const port=35000+Math.floor(Math.random()*18000),url=`http://localhost:${port}`,key='test-secret-'+ 'abc'.repeat(12);
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),PUBLIC_BASE_URL:url,ADMIN_KEY:key,DATA_FILE:path.join(temp,'db.json')},stdio:'ignore'});
after(()=>{child.kill();fs.rmSync(temp,{recursive:true,force:true});});
async function ready(){for(let i=0;i<50;i++){try{const r=await fetch(url+'/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,70));}throw Error('Server startup failed');}
test('link: authorise, create, sign only once, return audit and data',async()=>{
  await ready();
  const unauth=await fetch(url+'/api/sign-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unauth.status,401);
  const created=await fetch(url+'/api/sign-requests',{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':key},body:JSON.stringify({orderNumber:'OS-2026-00001',clientName:'Cliente Exemplo',serviceTitle:'Troca disjuntor',summary:'Instalação',total:100})});
  assert.equal(created.status,201);const {id,url:link}=await created.json();assert.ok(link.startsWith(url+'/s/'));
  const token=link.split('/').pop();
  const preview=await (await fetch(url+'/api/public/'+token)).json();assert.equal(preview.status,'pending');assert.equal(preview.total,100);
  const invalid=await fetch(url+'/api/public/'+token+'/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Cliente',accepted:false,image:'data:image/png;base64,'+'A'.repeat(150)})});assert.equal(invalid.status,400);
  const signed=await fetch(url+'/api/public/'+token+'/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Cliente Exemplo',accepted:true,image:'data:image/png;base64,'+'A'.repeat(150),location:{lat:-3.73,lon:-38.52,accuracy:20}})});assert.equal(signed.status,200);
  const again=await fetch(url+'/api/public/'+token+'/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Cliente Exemplo',accepted:true,image:'data:image/png;base64,'+'A'.repeat(150)})});assert.equal(again.status,409);
  const query=await fetch(url+'/api/sign-requests/'+id,{headers:{'X-API-Key':key}});assert.equal(query.status,200);const remote=await query.json();assert.equal(remote.status,'signed');assert.equal(remote.signature.location.lat,-3.73);assert.ok(remote.signature.audit.length===64);assert.ok(remote.signature.signedAt);
  const web=await fetch(link);assert.equal(web.status,200);assert.match(await web.text(),/Visualizar documento em PDF/);
});
