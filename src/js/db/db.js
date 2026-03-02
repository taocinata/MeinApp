/**
 * db.js — IndexedDB wrapper (promise-based)
 *
 * Stores: routines, therapy, logs, reminders, events
 */

const DB_NAME    = 'meinapp';
const DB_VERSION = 2;

const STORES = {
  routines:  { keyPath: 'id', indexes: [{ name: 'category', unique: false }] },
  therapy:   { keyPath: 'id', indexes: [{ name: 'type',     unique: false }] },
  logs:      { keyPath: 'id', indexes: [{ name: 'timestamp',unique: false }, { name: 'category', unique: false }] },
  reminders: { keyPath: 'id', indexes: [{ name: 'nextTrigger', unique: false }, { name: 'status', unique: false }] },
  events:    { keyPath: 'id', indexes: [{ name: 'date', unique: false }, { name: 'type', unique: false }] },
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, conf] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: conf.keyPath });
          for (const idx of conf.indexes) {
            store.createIndex(idx.name, idx.name, { unique: idx.unique });
          }
        }
      }
    };

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return { transaction, store };
  });
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── CRUD helpers ──────────────────────────────────────────

export async function getAll(storeName) {
  const { store } = await tx(storeName);
  return wrap(store.getAll());
}

export async function getById(storeName, id) {
  const { store } = await tx(storeName);
  return wrap(store.get(id));
}

export async function getByIndex(storeName, indexName, value) {
  const { store } = await tx(storeName);
  return wrap(store.index(indexName).getAll(value));
}

export async function put(storeName, record) {
  const { store } = await tx(storeName, 'readwrite');
  return wrap(store.put(record));
}

export async function remove(storeName, id) {
  const { store } = await tx(storeName, 'readwrite');
  return wrap(store.delete(id));
}

export async function clear(storeName) {
  const { store } = await tx(storeName, 'readwrite');
  return wrap(store.clear());
}

// ── Store-specific helpers ─────────────────────────────────

export const db = {
  routines:  { getAll: () => getAll('routines'),  get: id => getById('routines', id),  save: r => put('routines', r),  remove: id => remove('routines', id)  },
  therapy:   { getAll: () => getAll('therapy'),   get: id => getById('therapy', id),   save: r => put('therapy', r),   remove: id => remove('therapy', id)   },
  logs:      { getAll: () => getAll('logs'),       get: id => getById('logs', id),      save: r => put('logs', r),      remove: id => remove('logs', id)      },
  reminders: { getAll: () => getAll('reminders'),  get: id => getById('reminders', id), save: r => put('reminders', r), remove: id => remove('reminders', id) },
  events:    { getAll: () => getAll('events'),     get: id => getById('events', id),    save: e => put('events', e),    remove: id => remove('events', id)    },
};

export default db;
