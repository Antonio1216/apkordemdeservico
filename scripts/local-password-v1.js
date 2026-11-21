/* ACR OS Pro: base de credenciais locais para futura integração.
 * Não substitui o login atual. Não cria usuário padrão nem aceita senha em claro.
 * Requer contexto seguro (WebCrypto) e ACRLocalStore.
 */
(() => {
  'use strict';
  const encoder = new TextEncoder();
  const ITERATIONS = 310000;
  const KEY = 'local-auth:credentials:v1';
  const cryptoApi = globalThis.crypto;
  function requireCrypto() {
    if (!cryptoApi?.subtle || !cryptoApi?.getRandomValues) throw Error('Criptografia segura indisponível neste dispositivo.');
  }
  function hex(bytes) { return Array.from(bytes, x => x.toString(16).padStart(2,'0')).join(''); }
  function unhex(value) {
    if (typeof value !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(value)) throw Error('Registro de autenticação inválido.');
    return Uint8Array.from(value.match(/../g), x => parseInt(x,16));
  }
  async function derive(password,salt,iterations=ITERATIONS) {
    const material=await cryptoApi.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
    return new Uint8Array(await cryptoApi.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,256));
  }
  function safeEqual(a,b) {
    let difference=a.length ^ b.length;
    for(let i=0;i<Math.max(a.length,b.length);i++) difference|=(a[i]||0)^(b[i]||0);
    return difference===0;
  }
  async function createVerifier(password) {
    requireCrypto();
    if(typeof password!=='string'||password.length<12) throw Error('A senha local deve ter pelo menos 12 caracteres.');
    const salt=cryptoApi.getRandomValues(new Uint8Array(16));
    return {schema:1,algorithm:'PBKDF2-SHA256',iterations:ITERATIONS,salt:hex(salt),hash:hex(await derive(password,salt))};
  }
  async function verify(password,record) {
    requireCrypto();
    if(typeof password!=='string'||!record||record.schema!==1||record.algorithm!=='PBKDF2-SHA256'||record.iterations!==ITERATIONS) return false;
    try { return safeEqual(await derive(password,unhex(record.salt),record.iterations),unhex(record.hash)); }
    catch { return false; }
  }
  Object.defineProperty(globalThis,'ACRLocalPassword',{value:Object.freeze({createVerifier,verify}),writable:false,configurable:false});
})();
