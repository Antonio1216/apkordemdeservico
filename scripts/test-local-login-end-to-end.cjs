/* Teste real do cadastro inicial e autenticação local com WebCrypto do Node. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const rows=new Map();
const store={
 entries:async()=>[...rows].map(([key,value])=>({key,value})),
 get:async key=>rows.get(key)||null,
 createFirstAdminAtomic:async(key,value)=>{if(rows.size)throw Error('Banco não está vazio.');rows.set(key,value);}
};
const ctx={crypto:crypto.webcrypto,TextEncoder,Uint8Array,Array,Object,Date,Error,Map,structuredClone,globalThis:null,ACRLocalStore:store};
ctx.globalThis=ctx;
for(const file of ['local-password-v1.js','local-first-run-v1.js','local-auth-prototype.js']){
 vm.runInNewContext(fs.readFileSync('scripts/'+file,'utf8'),ctx,{filename:file});
}
(async()=>{
 const setup=ctx.ACRLocalFirstRun,auth=ctx.ACRLocalAuthPrototype;
 await setup.createFirstAdmin({login:'admin',name:'Administrador Local',password:'SenhaDeTeste!123'});
 const user=await auth.authenticate('admin','SenhaDeTeste!123');
 assert.equal(user.perfil,'Administrador');
 assert.equal(user.permissions.admin,true);
 await assert.rejects(auth.authenticate('admin','senha-errada'),/inválidos/);
 await assert.rejects(setup.createFirstAdmin({login:'outro',name:'Outro Administrador',password:'SenhaDeTeste!123'}),/Banco não está vazio/);
 console.log('PASSOU: senha PBKDF2, login válido, senha incorreta e segundo cadastro bloqueado.');
})().catch(e=>{console.error(e);process.exitCode=1;});
