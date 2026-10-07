'use client';

// ── 서버에도 함께 저장하기 (2026-10-07) ──
//
// 왜 생겼나: 이 앱은 쓴 내용을 브라우저 안(IndexedDB)에만 두었다.
// 그래서 다른 컴퓨터·다른 브라우저·카톡 안 창으로 들어오면 "이전 자료가 없다"는 문의가 반복됐다.
// 이제 전화번호+이름으로 서버 보관함(Supabase Storage, 비공개 버킷 yeollin)에도 함께 둔다.
//
// 안전 원칙 (witak-course 2026-09-02/03 사고에서 배운 것):
//  1. 서버 내용을 한 번 받아 본 뒤에만 올린다 (빈 브라우저가 서버를 지우지 못하게)
//  2. 빈 값은 절대 올리지 않는다
//  3. 양쪽에 다 있으면 칸 단위로 합친다 (빈 칸은 채워진 칸을 못 이김, 둘 다 있으면 나중 것)
//  4. 내용이 줄어드는 저장·삭제는 서버가 먼저 예전 것을 백업해 둔다 (app/api/sync)
//  5. 사진이 많아 자료가 크므로, 서버에는 서류 칸(key)마다 따로 두고
//     **바뀐 칸만** 올리고 내려받는다 (전송량 절약 — 무료 한도 안에서 쓰기 위해)
//
// 서버와 주고받는 큰 내용(사진 포함 JSON)은 Vercel 함수(4.5MB 한도)를 거치지 않고
// 서버가 발급한 1회용 주소로 브라우저가 보관함과 직접 주고받는다.

import { idbGet, idbPut, idbKeys } from './idb';
import { mergeValue, isEmpty } from './mergeData';

const ME_KEY = 'yeollin:me';      // {phone, name}
const META_KEY = 'yeollin:sync';  // {key: {h, t}}  h=내용 지문, t=저장 시각
const SKIP_KEY = 'yeollin:skip-login'; // (sessionStorage) 이번 방문엔 연결 안 함

// localStorage 에 있는 작은 정보도 함께 맞춘다 (체크 표시·서류 진행 상태)
export const LS_SYNC_KEYS = ['checks', 'docstate'];
const LS_PREFIX = 'ls:';

// ── 누구인가 ──
export function getMe() {
  if (typeof window === 'undefined') return null;
  try {
    const me = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
    return me && me.phone && me.name ? me : null;
  } catch { return null; }
}
export function setMe(me) { try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch { /* ignore */ } }
export function clearMe() { try { localStorage.removeItem(ME_KEY); } catch { /* ignore */ } }
export function skipLoginThisVisit() { try { sessionStorage.setItem(SKIP_KEY, '1'); } catch { /* ignore */ } }
export function loginSkipped() { try { return !!sessionStorage.getItem(SKIP_KEY); } catch { return false; } }
export function unskipLogin() { try { sessionStorage.removeItem(SKIP_KEY); } catch { /* ignore */ } }

export function normalizePhone(s) { return String(s || '').replace(/\D/g, ''); }
export function validPhone(p) { return /^01[016789]\d{7,8}$/.test(p); }
export function normalizeName(s) { return String(s || '').replace(/\s+/g, ''); }
export function maskPhone(p) {
  const d = normalizePhone(p);
  if (d.length < 10) return d;
  return `${d.slice(0, 3)}-${'*'.repeat(d.length - 7)}-${d.slice(-4)}`;
}
export function maskName(n) {
  const s = normalizeName(n);
  if (s.length <= 1) return s;
  return s[0] + '○'.repeat(Math.max(1, s.length - 2)) + (s.length > 2 ? s.slice(-1) : '');
}

// ── 내용 지문(hash) ──
// 같은 내용이면 같은 글자가 나오게 해서, 서버와 같은지 전송 없이 비교한다
function hashStr(str) {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (h1 * 33) ^ c; h2 = (h2 * 33) ^ c;
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + str.length.toString(36);
}

function readMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; } }
function writeMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* ignore */ } }
function setMeta(key, h, t) { const m = readMeta(); m[key] = { h, t }; writeMeta(m); }
function dropMeta(key) { const m = readMeta(); delete m[key]; writeMeta(m); }
export function clearMeta() { try { localStorage.removeItem(META_KEY); } catch { /* ignore */ } }

// ── 상태 알림 (화면의 작은 표시용) ──
// status: 'off'(연결 안 함) | 'loading' | 'saving' | 'saved' | 'error' | 'idle'
let status = { state: 'off', at: null, detail: '' };
export function getStatus() { return status; }
function emit(state, detail = '') {
  status = { state, at: new Date().toISOString(), detail };
  try { window.dispatchEvent(new CustomEvent('yeollin-sync', { detail: status })); } catch { /* ignore */ }
}

// ── 서버 창구 ──
async function api(action, extra = {}) {
  const me = getMe();
  if (!me) throw new Error('no-me');
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: me.phone, name: me.name, action, ...extra }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error || `서버 오류(${res.status})`);
    e.code = json.code || res.status;
    throw e;
  }
  return json;
}

// ── 값 읽고 쓰기 (IndexedDB 칸 / localStorage 칸을 한 모양으로) ──
async function readValue(key) {
  if (key.startsWith(LS_PREFIX)) {
    try { const raw = localStorage.getItem('yeollin:' + key.slice(LS_PREFIX.length)); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  try { return await idbGet(key); } catch { return undefined; } // undefined = 못 읽음
}
async function writeValue(key, value) {
  if (key.startsWith(LS_PREFIX)) {
    localStorage.setItem('yeollin:' + key.slice(LS_PREFIX.length), JSON.stringify(value));
    return;
  }
  await idbPut(key, value);
}

// 서버에 받아 본 적이 있는지 (이번 방문)
let synced = false;
export function isSynced() { return synced; }

// ── 서버 → 이 브라우저 (앱을 열 때 한 번) ──
// 돌려주는 값: {ok, isNew, pulled, pushed, serverKeys} / 실패하면 {ok:false, error, code}
export async function pullRemote() {
  const me = getMe();
  if (!me) { emit('off'); return { ok: false, error: 'no-me' }; }
  emit('loading');

  let login;
  try {
    login = await api('login');
  } catch (e) {
    emit('error', e.code === 'name' ? 'name' : '불러오기 실패');
    return { ok: false, error: e.message, code: e.code };
  }

  const remoteKeys = (login.index && login.index.keys) || {};
  const meta = readMeta();

  // 이 브라우저에 있는 칸 목록
  let localKeys = [];
  try { localKeys = await idbKeys(); } catch { localKeys = []; }
  for (const k of LS_SYNC_KEYS) localKeys.push(LS_PREFIX + k);

  const toDownload = [];
  const toPush = new Set();
  const localValues = {};
  const localHashes = {};

  for (const key of new Set([...localKeys, ...Object.keys(remoteKeys)])) {
    const v = await readValue(key);
    localValues[key] = v;
    if (v !== undefined && v !== null && !isEmpty(v)) localHashes[key] = hashStr(JSON.stringify(v));
  }

  for (const [key, r] of Object.entries(remoteKeys)) {
    const lh = localHashes[key];
    if (lh && lh === r.h) { setMeta(key, r.h, r.t); continue; } // 이미 같다
    if (localValues[key] === undefined) continue; // 이 브라우저 저장소를 못 읽는 상태 — 건드리지 않음
    toDownload.push(key);
  }
  for (const key of Object.keys(localHashes)) {
    if (!remoteKeys[key]) toPush.add(key); // 서버에 아직 없는 칸은 올린다
  }

  let pulled = 0;
  if (toDownload.length) {
    let urls = {};
    try { urls = (await api('down', { keys: toDownload })).urls || {}; } catch (e) {
      emit('error', '불러오기 실패');
      return { ok: false, error: e.message };
    }
    for (const key of toDownload) {
      const url = urls[key];
      if (!url) continue;
      let remoteVal;
      try {
        const res = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) throw new Error('down ' + res.status);
        remoteVal = await res.json();
      } catch {
        emit('error', '불러오기 실패');
        return { ok: false, error: '내려받기 실패' };
      }
      const localVal = localValues[key];
      const r = remoteKeys[key];
      let merged;
      if (localVal === null || isEmpty(localVal)) {
        merged = remoteVal;
      } else {
        // ★ 칸 단위로 합친다 — 한쪽에만 있는 내용은 지우지 않는다
        const lt = Date.parse((meta[key] && meta[key].t) || '') || 0;
        const rt = Date.parse(r.t || '') || 0;
        merged = lt > rt ? mergeValue(localVal, remoteVal) : mergeValue(remoteVal, localVal);
      }
      try { await writeValue(key, merged); } catch { continue; }
      pulled++;
      const mh = hashStr(JSON.stringify(merged));
      if (mh === r.h) setMeta(key, r.h, r.t);
      else { setMeta(key, '', r.t); toPush.add(key); } // 합친 결과가 서버와 다르면 서버를 맞춰 준다
    }
  }

  synced = true;
  emit('idle');

  let pushed = 0;
  for (const key of toPush) { if (await pushKey(key)) pushed++; }
  if (pushed) emit('saved');

  return { ok: true, isNew: !!login.isNew, pulled, pushed, serverKeys: Object.keys(remoteKeys).length + pushed };
}

// ── 이 브라우저 → 서버 ──
const timers = new Map();
const pending = new Set();

/** 저장이 일어났다고 알려 주면 잠깐 기다렸다가 그 칸만 올린다 (lib/store.js 가 부른다) */
export function noteSaved(key) {
  if (!getMe()) return;
  pending.add(key);
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => pushKey(key), 2000));
}

export function noteLocalSaved(lsKey) {
  if (LS_SYNC_KEYS.includes(lsKey)) noteSaved(LS_PREFIX + lsKey);
}

/** 지금 바로 올린다. 성공하면 true */
export async function pushKey(key) {
  clearTimeout(timers.get(key)); timers.delete(key);
  if (!getMe()) return false;
  if (!synced) return false; // ★ 서버를 아직 못 받아 봤으면 올리지 않는다
  const value = await readValue(key);
  if (value === undefined || value === null || isEmpty(value)) { pending.delete(key); return false; } // ★ 빈 값은 올리지 않는다
  const str = JSON.stringify(value);
  const h = hashStr(str);
  const meta = readMeta()[key];
  if (meta && meta.h === h) { pending.delete(key); return false; } // 서버와 같다
  const savedAt = new Date().toISOString();
  emit('saving');
  try {
    const { url } = await api('up', { key, size: str.length, hash: h });
    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=0, no-store' },
      body: str,
    });
    if (!put.ok) throw new Error('upload ' + put.status);
    await api('commit', { key, size: str.length, hash: h, savedAt });
    setMeta(key, h, savedAt);
    pending.delete(key);
    emit('saved');
    return true;
  } catch (e) {
    emit('error', '서버 저장 실패');
    return false;
  }
}

/** 아직 못 올린 칸을 모두 지금 올린다 (화면을 닫거나 숨길 때) */
export function flushAll() {
  for (const key of Array.from(pending)) pushKey(key);
}

/** 한 칸을 서버에서도 지운다 (서버가 먼저 백업해 둔다) */
export async function removeRemote(key) {
  if (!getMe()) return;
  clearTimeout(timers.get(key)); timers.delete(key); pending.delete(key);
  dropMeta(key);
  try { await api('del', { key }); } catch { /* 서버에 못 알려도 이 브라우저에서는 지워졌다 */ }
}

/** 서버 보관함의 내 자료를 모두 지운다 (서버가 먼저 백업해 둔다) */
export async function wipeRemote() {
  if (!getMe()) return false;
  timers.forEach((t) => clearTimeout(t)); timers.clear(); pending.clear();
  clearMeta();
  try { await api('wipe'); return true; } catch { return false; }
}

// 화면을 닫거나 다른 앱으로 넘어갈 때 마저 올린다
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
}
