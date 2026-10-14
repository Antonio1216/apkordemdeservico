'use strict';
const crypto=require('node:crypto');
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buffer){
 let bits=0,value=0,output='';
 for(const byte of buffer){value=(value<<8)|byte;bits+=8;while(bits>=5){output+=ALPHABET[(value>>>(bits-=5))&31];}}
 if(bits>0)output+=ALPHABET[(value<<(5-bits))&31];
 return output;
}
function decode32(raw){
 if(typeof raw!=='string'||!/^[A-Z2-7]{24,64}$/.test(raw))throw Error('Segredo inválido.');
 let buffer=0,bits=0,out=[];
 for(const ch of raw){buffer=(buffer<<5)|ALPHABET.indexOf(ch);bits+=5;if(bits>=8){out.push((buffer>>>(bits-=8))&255);}}
 return Buffer.from(out);
}
function encrypt(secret,key){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update('ACR-MFA-AES-GCM-v1:'+key).digest(),iv);
 const data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');
}
function decrypt(encoded,key){
 const data=Buffer.from(encoded,'base64');
 if(data.length<29)throw Error('Credencial inválida.');
 const decipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update('ACR-MFA-AES-GCM-v1:'+key).digest(),data.subarray(0,12));
 decipher.setAuthTag(data.subarray(12,28));
 return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8');
}
function totpAt(secret,step){
 const input=Buffer.alloc(8);input.writeBigUInt64BE(BigInt(step));
 const h=crypto.createHmac('sha1',decode32(secret)).update(input).digest();
 const offset=h[h.length-1]&15;
 const num=(h.readUInt32BE(offset)&0x7fffffff)%1_000_000;
 return String(num).padStart(6,'0');
}
function verifyTotp(secret,code,now=Date.now(),usedStep=-1){
 if(typeof code!=='string'||!/^\d{6}$/.test(code))return -1;
 const step=Math.floor(now/30000);
 for(let i=-1;i<=1;i++){
  const n=step+i;
  if(n<=usedStep)continue;
  const computed=totpAt(secret,n);
  if(crypto.timingSafeEqual(Buffer.from(computed),Buffer.from(code)))return n;
 }
 return -1;
}
async function sendResetMail({to,link}){
 const token=process.env.RESEND_API_KEY,from=process.env.PASSWORD_RESET_FROM_EMAIL;
 if(!token||!from||!to)throw Error('Serviço de e-mail não configurado.');
 if(!/^https:\/\//.test(link))throw Error('Link de recuperação deve usar HTTPS.');
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(9000),
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({from,to,subject:'ACR OS Pro — redefinir sua senha',
   text:'Foi solicitada uma redefinição de senha para sua conta ACR OS Pro.\n\nAbra o link abaixo para criar uma senha nova (válido por 15 minutos):\n'+link+'\n\nSe você não solicitou, ignore esta mensagem. Administradores não podem usar a recuperação por e-mail.'})});
 if(!response.ok)throw Error('Serviço de envio não aceitou a solicitação.');
}
module.exports={base32,encrypt,decrypt,totpAt,verifyTotp,sendResetMail};
