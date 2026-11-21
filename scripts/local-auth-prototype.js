/* ACR OS Pro: protótipo isolado de autenticação local.
 * Não altera o login existente. Contas só podem ser provisionadas por migração
 * autenticada e validada, nunca por criação automática de administrador.
 */
(() => {
  'use strict';
  const password = globalThis.ACRLocalPassword;
  const store = globalThis.ACRLocalStore;
  if (!password || !store) throw Error('Módulos locais de senha e armazenamento indisponíveis.');
  const PREFIX='local-auth:user:';
  const attempts=new Map();
  const MAX_FAILURES=5;
  const COOLDOWN=60000;
  function normalizeLogin(login) {
    if (typeof login!=='string') throw Error('Login inválido.');
    const value=login.trim().toLowerCase();
    if(!/^[a-z0-9._@-]{3,100}$/.test(value)) throw Error('Login inválido.');
    return value;
  }
  function publicUser(record) {
    return Object.freeze({login:record.login,perfil:record.perfil,permissions:structuredClone(record.permissions)});
  }
  async function provisionVerifiedUser() {
    // Bloqueado até implementar migração autenticada, verificável e consentida.
    // Um booleano não constitui prova de autorização.
    throw Error('Provisionamento bloqueado até migração autenticada e validada.');
  }
  async function authenticate(login,secret) {
    const name=normalizeLogin(login);
    const now=Date.now();
    const state=attempts.get(name);
    if(state && state.until>now) throw Error('Aguarde antes de tentar novamente.');
    const record=await store.get(PREFIX+name);
    const valid=record?.schema===1 && await password.verify(secret,record.verifier);
    if(!valid) {
      const failures=(state?.until>now ? 0 : state?.failures||0)+1;
      attempts.set(name,{failures,until:failures>=MAX_FAILURES?now+COOLDOWN:0});
      throw Error('Login ou senha inválidos.');
    }
    attempts.delete(name);
    return publicUser(record);
  }
  Object.defineProperty(globalThis,'ACRLocalAuthPrototype',{value:Object.freeze({authenticate,provisionVerifiedUser}),configurable:false,writable:false});
})();
