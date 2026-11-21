/* Primeiro acesso local: configuração EXPLÍCITA, sem conta/senha padrão.
 * Somente para instalação nova. Não importa nem altera credenciais antigas.
 * A inicialização não substitui a migração autenticada de contas existentes.
 */
(() => {
  'use strict';
  const store = globalThis.ACRLocalStore;
  const password = globalThis.ACRLocalPassword;
  if (!store || !password) throw Error('Armazenamento e criptografia local indisponíveis.');
  const KEY = 'local-auth:setup:v1';
  const USER_PREFIX = 'local-auth:user:';
  let pending = false;
  const normalize = value => {
    if (typeof value !== 'string' || !/^[a-z0-9._@-]{3,100}$/.test(value.trim().toLowerCase())) {
      throw Error('Nome de usuário inválido.');
    }
    return value.trim().toLowerCase();
  };
  async function needsSetup() {
    return (await store.get(KEY)) === null;
  }
  async function initialize({login, secret, confirmNewInstallation} = {}) {
    if (confirmNewInstallation !== true) throw Error('Confirme que esta é uma instalação nova.');
    if (pending) throw Error('Configuração inicial em andamento.');
    pending = true;
    try {
      if (!(await needsSetup())) throw Error('Administrador local já configurado.');
      const name = normalize(login);
      if (typeof secret !== 'string' || secret.length < 12) throw Error('Senha deve ter pelo menos 12 caracteres.');
      if (await store.get(USER_PREFIX + name)) throw Error('Usuário já existe.');
      const verifier = await password.createVerifier(secret);
      const record = {
        schema: 1, login: name, perfil: 'admin',
        permissions: {admin: true, ordens: true, clientes: true, equipamentos: true,
          chamados: true, licencas: true, relatorios: true},
        verifier
      };
      // Persistir primeiro a conta, depois a marca de configuração. Falhas não
      // devem criar acesso automático; recuperar via fluxo de manutenção seguro.
      await store.set(USER_PREFIX + name, record);
      await store.set(KEY, {schema: 1, login: name});
      return {login: name, perfil: 'admin'};
    } finally { pending = false; }
  }
  Object.defineProperty(globalThis,'ACRLocalFirstRun',{
    value:Object.freeze({needsSetup,initialize}),writable:false,configurable:false
  });
})();
