// 문서 작성 내용(첨부 이미지 포함)을 브라우저 내부 저장소(IndexedDB)에 보관.
// localStorage보다 용량이 커서 사진·PDF(base64)도 안전하게 저장됨.
//
// 2026-10-07: 전화번호+이름으로 **서버 보관함에도 함께** 저장한다 (lib/sync.js).
// 여기서는 저장이 일어날 때마다 sync 에 "이 칸이 바뀌었다"고만 알려 주고,
// 서버와 맞추는 일은 전부 sync.js 가 한다. (화면 코드는 바꿀 필요 없음)

import { idbGet, idbPut, idbDelete, idbKeys, idbWipe } from './idb';
import { noteSaved, noteLocalSaved, removeRemote, wipeRemote, clearMeta } from './sync';

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
    await idbPut(key, value);
    noteSaved(key); // 서버에도 곧 올린다
    return true;
  } catch { return false; }
}

export async function loadForm(key) {
  askPersist();
  try {
    const v = await idbGet(key);
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
    const keys = await idbKeys();
    return keys.filter((k) => k !== 'basic-info').length;
  } catch { return null; }
}

// 화면 위치·체크 표시처럼 작은 정보는 localStorage에 즉시 저장 (새로고침해도 그대로 이어짐)
const LOCAL_PREFIX = 'yeollin:';

export function saveLocal(key, value) {
  try {
    localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
    noteLocalSaved(key); // 체크·진행상태는 서버에도
  } catch { /* ignore */ }
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

// 이 브라우저에 저장된 내용(문서 입력값·첨부·기본사항·체크·화면위치)을 모두 지움.
// server:true 면 서버 보관함의 내 자료도 함께 지운다(서버가 먼저 백업해 둠).
// server:false 는 '다른 번호로 바꾸기'처럼 이 브라우저만 비울 때 쓴다 — 서버 자료는 그대로 남는다.
export async function clearAll({ server = true } = {}) {
  if (server) await wipeRemote();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LOCAL_PREFIX) && k !== 'yeollin:me')
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  clearMeta();
  try { await idbWipe(); } catch { /* ignore */ }
}

export async function clearForm(key) {
  try { await idbDelete(key); } catch { /* ignore */ }
  removeRemote(key); // 서버에서도 지운다 (안 지우면 다음에 들어올 때 되살아난다)
}
