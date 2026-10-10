/* Banco local (IndexedDB) com fallback em memória quando o navegador bloqueia o IndexedDB. */
(function () {
  'use strict';
  const SMS = window.SMS = window.SMS || {};
  const NAME = (window.SMS_CONFIG && window.SMS_CONFIG.dbName) || 'souza-motion-studio';
  const STORES = ['media', 'projects', 'components', 'meta'];
  let dbp = null;
  const mem = {}; STORES.forEach(s => mem[s] = new Map());
  SMS.dbMemoryOnly = false;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(resolve => {
      try {
        if (!window.indexedDB) throw new Error('sem IndexedDB');
        const rq = indexedDB.open(NAME, 1);
        rq.onupgradeneeded = () => { const db = rq.result; STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); }); };
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = rq.onblocked = () => { SMS.dbMemoryOnly = true; resolve(null); };
      } catch (e) { SMS.dbMemoryOnly = true; resolve(null); }
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(db => {
      if (!db) return fn(null, store);
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, mode), os = t.objectStore(store);
        let out;
        try { out = fn(os, store); } catch (e) { reject(e); return; }
        t.oncomplete = () => resolve(out && out.__rq ? out.__rq.result : out);
        t.onerror = t.onabort = () => reject(t.error || new Error('Falha no banco local'));
      });
    });
  }
  function req(r) { return { __rq: r }; }
  SMS.db = {
    put(store, obj) { return tx(store, 'readwrite', (os, s) => { if (!os) { mem[s].set(obj.id, obj); return; } os.put(obj); }); },
    get(store, id) { return tx(store, 'readonly', (os, s) => os ? req(os.get(id)) : mem[s].get(id)); },
    all(store) { return tx(store, 'readonly', (os, s) => os ? req(os.getAll()) : Array.from(mem[s].values())); },
    del(store, id) { return tx(store, 'readwrite', (os, s) => { if (!os) { mem[s].delete(id); return; } os.delete(id); }); },
    clear(store) { return tx(store, 'readwrite', (os, s) => { if (!os) { mem[s].clear(); return; } os.clear(); }); },
    ready() { return open().then(() => !SMS.dbMemoryOnly); }
  };
})();
