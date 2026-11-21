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
  async function provisionVerifiedUser(user,secret,authorization) {
    // Exige autorização explícita de migração fornecida pelo integrador seguro.
    // Este protótipo não emite autorizações e não deve ser exposto na UI.
    // Um booleano não prova identidade nem autorização. Bloqueado até existir\n    // uma migração autenticada com validação de origem e consentimento.\n    throw Error('Provisionamento bloqueado até migração autenticada e validada.');
    const login=normalizeLogin(user?.login);
    if (!['Administrador','Tecnico','Usuário'].includes(user?.perfil)) throw Error('Perfil inválido.');
    if (!user.permissions || typeof user.permissions!=='object' || Array.isArray(user.permissions)) throw Error('Permissões inválidas.');
    const permissions={};
    for (const [key,value] of Object.entries(user.permissions)) {
      if(!/^[a-z][a-z0-9_-]{1,40}$/.test(key)||typeof value!=='boolean') throw Error('Permissão inválida.');
      permissions[key]=value;
    }
    const key=PREFIX+login;
    if(await store.get(key)!==null) throw Error('Usuário local já cadastrado.');
    const verifier=await password.createVerifier(secret);
    await store.set(key,{schema:1,login,perfil:user.perfil,permissions,verifier});
    return login;
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
