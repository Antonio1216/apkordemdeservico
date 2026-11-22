/* ACR OS Pro Local - armazenamento IndexedDB, sem dependência do Render.
 * Camada isolada: ainda precisa ser conectada aos módulos existentes.
 */
(() => {
  'use strict';
  const DB_NAME = 'acr-os-pro-local';
  const DB_VERSION = 1;
  const STORE = 'records';
  const BACKUP_FORMAT = 'acr-os-pro-local-backup';
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Banco local bloqueado por outra conexão.'));
    });
  }
  async function transact(mode, work) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Erro na transação local.'));
        tx.onabort = () => reject(tx.error || new Error('Transação local cancelada.'));
        try { work(tx.objectStore(STORE), value => { result = value; }); }
        catch (error) { tx.abort(); reject(error); }
      });
    } finally { db.close(); }
  }
  function validKey(key) {
    if (typeof key !== 'string' || !key || key.length > 300) throw new Error('Chave local inválida.');
    return key;
  }
  async function get(key) {
    validKey(key);
    return transact('readonly', (store, done) => {
      const req = store.get(key);
      req.onsuccess = () => done(req.result ? req.result.value : null);
    });
  }
  async function set(key, value) {
    validKey(key);
    const snapshot = structuredClone(value);
    await transact('readwrite', (store) => store.put({key, value: snapshot}));
  }
  async function createFirstAdminAtomic(key, record) {
    validKey(key);
    if (!key.startsWith('local-auth:user:') || !record || record.schema !== 1 || record.perfil !== 'Administrador')
      throw new Error('Cadastro inicial inválido.');
    // A verificação e a escrita ocorrem na mesma transação IndexedDB.
    await transact('readwrite', (store) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        if (request.result) {
          request.transaction.abort();
          return;
        }
        store.add({key, value: structuredClone(record)});
      };
    }).catch(() => { throw new Error('Banco não está vazio ou cadastro inicial já realizado.'); });
  }
  async function remove(key) {
    validKey(key);
    await transact('readwrite', store => store.delete(key));
  }
  async function entries() {
    return transact('readonly', (store, done) => {
      const req = store.getAll();
      req.onsuccess = () => done(req.result.map(({key, value}) => ({key, value})));
    });
  }
  async function exportBackup() {
    return JSON.stringify({format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), records: (await entries()).filter(row => !row.key.startsWith('local-auth:'))});
  }
  async function importBackup(json) {
    const payload = typeof json === 'string' ? JSON.parse(json) : json;
    if (!payload || payload.format !== BACKUP_FORMAT || payload.version !== 1 || !Array.isArray(payload.records)) {
      throw new Error('Backup incompatível.');
    }
    const keys = new Set();
    const records = payload.records.map(row => {
      if (!row || typeof row !== 'object') throw new Error('Registro inválido no backup.');
      const key = validKey(row.key);
      if (key.startsWith('local-auth:')) throw new Error('Backup contém credenciais; importação bloqueada.');
      if (keys.has(key) || !Object.prototype.hasOwnProperty.call(row, 'value')) throw new Error('Backup com registros inválidos ou duplicados.');
      keys.add(key);
      return {key, value: structuredClone(row.value)};
    });
    // A importação é atômica: se falhar, a transação é revertida.
    await transact('readwrite', store => {
      store.clear();
      for (const record of records) store.put(record);
    });
    return records.length;
  }
  Object.defineProperty(window, 'ACRLocalStore', {
    value: Object.freeze({get, set, remove, entries, createFirstAdminAtomic, exportBackup, importBackup}),
    configurable: false, writable: false
  });
})();
