/* Sessão offline em memória: nunca persiste senhas, tokens ou privilégios. */
(() => {
  'use strict';
  let current = null;
  let generation = 0;
  const clone = value => structuredClone(value);
  function validate(user) {
    if (!user || typeof user !== 'object' || Array.isArray(user) ||
        typeof user.login !== 'string' || !/^[a-z0-9._@-]{3,100}$/.test(user.login) ||
        typeof user.perfil !== 'string' || !user.perfil ||
        !user.permissions || typeof user.permissions !== 'object' ||
        Array.isArray(user.permissions)) {
      throw Error('Identidade local inválida.');
    }
    return Object.freeze({
      login: user.login, perfil: user.perfil,
      permissions: Object.freeze(clone(user.permissions))
    });
  }
  async function signIn(login, password) {
    const epoch = ++generation;
    current = null;
    const auth = globalThis.ACRLocalAuthPrototype;
    if (!auth || typeof auth.authenticate !== 'function') throw Error('Autenticação offline indisponível.');
    const user = validate(await auth.authenticate(login, password));
    if (epoch !== generation) throw Error('Autenticação cancelada por outra operação.');
    current = user;
    return clone(user);
  }
  function getUser() { return current ? clone(current) : null; }
  function signOut() { generation++; current = null; }
  function hasPermission(permission) {
    return Boolean(current && typeof permission === 'string' &&
      Object.prototype.hasOwnProperty.call(current.permissions,permission) &&
      current.permissions[permission] === true);
  }
  Object.defineProperty(globalThis,'ACRLocalSession',{
    value:Object.freeze({signIn,getUser,signOut,hasPermission}),
    configurable:false,writable:false
  });
})();
