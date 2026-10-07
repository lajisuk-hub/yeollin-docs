// 브라우저 안 저장소(IndexedDB)를 여는 가장 밑단.
// lib/store.js(화면이 쓰는 저장/불러오기)와 lib/sync.js(서버와 맞추기)가 함께 쓴다.
// (둘이 서로를 불러오면 꼬이므로, 공통 부분만 여기로 뺐다 — 2026-10-07)

export const DB_NAME = 'yeollin-docs';
export const STORE = 'forms';

// 연결은 한 번만 열어 계속 쓴다 (저장할 때마다 새로 열면 연결이 쌓여 불안정해짐)
let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => {
      const db = req.result;
      // '전체 지우기' 등으로 저장소를 지우려 할 때 막지 않도록 연결을 닫아 준다
      db.onversionchange = () => { db.close(); dbPromise = null; };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => { dbPromise = null; reject(new Error('blocked')); };
  });
  return dbPromise;
}

export async function idbGet(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    rq.onsuccess = () => res(rq.result === undefined ? null : rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

export async function idbPut(key, value) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

export async function idbDelete(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function idbKeys() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => rej(rq.error);
  });
}

/** 저장소를 통째로 지운다 (처음부터 다시) */
export async function idbWipe() {
  try {
    if (dbPromise) { const db = await dbPromise.catch(() => null); db?.close(); dbPromise = null; }
  } catch { /* ignore */ }
  await new Promise((res) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = res; req.onerror = res; req.onblocked = res;
  });
}
