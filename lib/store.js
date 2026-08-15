// 문서 작성 내용(첨부 이미지 포함)을 브라우저 내부 저장소(IndexedDB)에 보관.
// localStorage보다 용량이 커서 사진·PDF(base64)도 안전하게 저장됨. (같은 브라우저 한정)

const DB_NAME = 'yeollin-docs';
const STORE = 'forms';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveForm(key, value) {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch { return false; }
}

export async function loadForm(key) {
  try {
    const db = await openDB();
    return await new Promise((res) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  } catch { return null; }
}

// 화면 위치·체크 표시처럼 작은 정보는 localStorage에 즉시 저장 (새로고침해도 그대로 이어짐)
const LOCAL_PREFIX = 'yeollin:';

export function saveLocal(key, value) {
  try { localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function loadLocal(key) {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// 이 브라우저에 저장된 내용(문서 입력값·첨부·기본사항·체크·화면위치)을 모두 지움
export async function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LOCAL_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  try {
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = res; req.onerror = res; req.onblocked = res;
    });
  } catch { /* ignore */ }
}

export async function clearForm(key) {
  try {
    const db = await openDB();
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = res;
      tx.onerror = res;
    });
  } catch { /* ignore */ }
}
