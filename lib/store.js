// 문서 작성 내용(첨부 이미지 포함)을 브라우저 내부 저장소(IndexedDB)에 보관.
// localStorage보다 용량이 커서 사진·PDF(base64)도 안전하게 저장됨. (같은 브라우저 한정)

const DB_NAME = 'yeollin-docs';
const STORE = 'forms';

// 연결은 한 번만 열어 계속 쓴다 (저장할 때마다 새로 열면 연결이 쌓여 불안정해짐)
let dbPromise = null;
function openDB() {
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

// 브라우저가 공간이 부족할 때 이 사이트 자료를 마음대로 지우지 않게 요청 (한 번만)
let persistAsked = false;
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* ignore */ }
}

// ⚠ 불러오기에 실패한 칸은 이번 방문 동안 저장하지 않는다.
// (못 읽었는데 빈 화면 상태로 저장하면 원래 있던 자료를 빈 값으로 덮어써 영영 사라짐)
const loadFailed = new Set();

export async function saveForm(key, value) {
  if (loadFailed.has(key)) return false;
  askPersist();
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
    return true;
  } catch { return false; }
}

export async function loadForm(key) {
  askPersist();
  try {
    const db = await openDB();
    const v = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    loadFailed.delete(key);
    return v || null;
  } catch {
    loadFailed.add(key);
    try { window.dispatchEvent(new Event('yeollin-load-failed')); } catch { /* ignore */ }
    return null;
  }
}

// 불러오기에 실패한 적이 있는지 (화면에 '다시 불러오기' 안내를 띄울 때 사용)
export const hasLoadFailure = () => loadFailed.size > 0;

// 이 브라우저에 저장된 서류 칸 수 (첫 화면에서 '여기에 자료가 있는지' 보여 주기용)
export async function countForms() {
  try {
    const db = await openDB();
    return await new Promise((res) => {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      rq.onsuccess = () => res((rq.result || []).filter((k) => k !== 'basic-info').length);
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

// 서류별 진행 상태('writing' 작성중 / 'done' 작성완료).
// 목록 화면에서 빠르게 읽어야 해서 입력값(사진 포함)과 따로, 작은 정보로만 보관한다.
export function getDocStates() {
  return loadLocal('docstate') || {};
}

export function setDocState(docId, state) {
  const map = getDocStates();
  if (state) map[docId] = state; else delete map[docId];
  saveLocal('docstate', map);
}

// 이 브라우저에 저장된 내용(문서 입력값·첨부·기본사항·체크·화면위치)을 모두 지움
export async function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LOCAL_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  try {
    if (dbPromise) { const db = await dbPromise.catch(() => null); db?.close(); dbPromise = null; }
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
