/* ACR OS Pro Local — repositórios locais por módulo.
 * Requer local-store.js; não efetua requisições HTTP.
 */
(() => {
  'use strict';
  const store = window.ACRLocalStore;
  if (!store) throw new Error('ACRLocalStore precisa ser carregado antes dos repositórios.');
  const defaults = Object.freeze({
    workspace: {revision: 0, clients: [], orders: [], drafts: [], finance: []},
    catalog: {revision: 0, companies: [], services: [], products: [], equipments: []},
    licenses: {revision: 0, companies: [], items: []},
    tickets: {revision: 0, tickets: [], novos: []},
    users: {revision: 0, users: []}
  });
  const copy = value => structuredClone(value);
  const validRevision = revision => Number.isSafeInteger(revision) && revision >= 0;
  const allowed = name => {
    if (!Object.prototype.hasOwnProperty.call(defaults, name)) throw new Error('Módulo local desconhecido.');
    return name;
  };
  async function read(name) {
    name = allowed(name);
    const data = await store.get('module:' + name);
    if (data === null) return copy(defaults[name]);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !validRevision(data.revision)) {
      throw new Error('Dados locais corrompidos: ' + name + '. Restaure um backup válido.');
    }
    return copy(data);
  }
  const pending = new Map();
  function serialize(name, operation) {
    const previous = pending.get(name) || Promise.resolve();
    const result = previous.catch(() => {}).then(operation);
    pending.set(name, result);
    result.finally(() => { if (pending.get(name) === result) pending.delete(name); }).catch(() => {});
    return result;
  }
  async function save(name, data, expectedRevision) {
    name = allowed(name);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dados locais inválidos.');
    if (expectedRevision !== undefined && !validRevision(expectedRevision)) throw new Error('Revisão local inválida.');
    return serialize(name, async () => {
    const current = await read(name);
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      const err = new Error('Os dados foram alterados. Atualize a tela e tente novamente.');
      err.status = 409;
      throw err;
    }
    const next = {...copy(data), revision: current.revision + 1};
    await store.set('module:' + name, next);
    return copy(next);
    });
  }
  async function resetModule(name) {
    name = allowed(name);
    await serialize(name, () => store.remove('module:' + name));
  }
  Object.defineProperty(window, 'ACRLocalModules', {
    value: Object.freeze({read, save, resetModule}),
    configurable: false, writable: false
  });
})();
