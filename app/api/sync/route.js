// 서버 보관함 창구 (2026-10-07)
// 전화번호+이름으로 자기 자료 칸을 찾아 주고, 큰 내용은 1회용 주소로 브라우저가 직접 올리고 받게 한다.
// (Vercel 함수는 한 번에 4.5MB까지만 받으므로 사진이 든 JSON은 여기를 거치면 안 된다)
//
// 보관함 구조 (Supabase Storage, 비공개 버킷 yeollin — witak-course와 같은 프로젝트)
//   u/<uid>/who.json        누구인지(이름 지문) — 전화번호만 알고 이름이 틀리면 못 들어온다
//   u/<uid>/index.json      칸 목록 {keys:{<key>:{h,size,t}}}
//   u/<uid>/d/<key>.json    칸 내용 (사진 포함)
//   u/<uid>/b/<key>/<시각>.json   줄어드는 저장·삭제 전에 남겨 둔 백업 (칸마다 최근 5개)
// uid 는 전화번호의 해시라 보관함만 보고는 번호를 알 수 없다.

import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = 'yeollin';
const BACKUP_KEEP = 5;
const SIGN_SECONDS = 600;

const sha = (s) => createHash('sha256').update(s).digest('hex');
const normalizePhone = (s) => String(s || '').replace(/\D/g, '');
const validPhone = (p) => /^01[016789]\d{7,8}$/.test(p);
const normalizeName = (s) => String(s || '').replace(/\s+/g, '');
const validKey = (k) => typeof k === 'string' && /^[A-Za-z0-9:_-]{1,60}$/.test(k);

function auth(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra };
}
const objUrl = (path) => `${URL_BASE}/storage/v1/object/${BUCKET}/${path}`;

async function readJson(path) {
  try {
    const res = await fetch(`${objUrl(path)}?t=${Date.now()}`, {
      headers: auth({ 'Cache-Control': 'no-cache' }), cache: 'no-store',
    });
    if (!res.ok) return null;
    return JSON.parse(await res.text());
  } catch { return null; }
}

async function writeJson(path, data) {
  const res = await fetch(objUrl(path), {
    method: 'POST',
    headers: auth({ 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=0, no-store' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`보관함 쓰기 실패 ${res.status}`);
}

async function copyObj(from, to) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/copy`, {
    method: 'POST',
    headers: auth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ bucketId: BUCKET, sourceKey: from, destinationKey: to }),
  });
  return res.ok;
}

async function listObj(prefix) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: auth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (!res.ok) return [];
  const arr = await res.json();
  return Array.isArray(arr) ? arr.filter((f) => f.metadata).map((f) => f.name) : [];
}

async function deleteObjs(paths) {
  if (!paths.length) return;
  await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: auth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: paths }),
  });
}

/** 칸 내용을 백업 칸에 복사하고 오래된 백업은 정리한다 (실패해도 저장은 막지 않는다) */
async function backupKey(uid, key) {
  try {
    const dir = `u/${uid}/b/${key}/`;
    await copyObj(`u/${uid}/d/${key}.json`, `${dir}${Date.now()}.json`);
    const names = (await listObj(dir.slice(0, -1))).sort(); // 이름이 시각이라 이름순 = 오래된 순
    const old = names.slice(0, Math.max(0, names.length - BACKUP_KEEP));
    await deleteObjs(old.map((n) => dir + n));
  } catch (e) { console.error('백업 실패', e); }
}

export async function POST(req) {
  try {
    if (!URL_BASE || !KEY) return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(body.phone);
    const name = normalizeName(body.name);
    if (!validPhone(phone)) return Response.json({ error: '전화번호 형식이 맞지 않습니다.', code: 'phone' }, { status: 400 });
    if (name.length < 1 || name.length > 20) return Response.json({ error: '이름을 확인해 주세요.', code: 'name' }, { status: 400 });

    const uid = sha(`yeollin|${phone}`).slice(0, 32);
    const nameHash = sha(`n|${uid}|${name}`);
    const whoPath = `u/${uid}/who.json`;
    const indexPath = `u/${uid}/index.json`;

    // 누구인지 확인 — 처음이면 등록, 이름이 다르면 거절
    let who = await readJson(whoPath);
    let isNew = false;
    if (!who) {
      who = { nameHash, createdAt: new Date().toISOString() };
      await writeJson(whoPath, who);
      isNew = true;
    } else if (who.nameHash !== nameHash) {
      return Response.json({ error: '이 전화번호는 다른 이름으로 등록되어 있습니다. 처음 연결할 때 쓴 이름을 그대로 넣어 주세요.', code: 'name' }, { status: 403 });
    }

    const action = body.action;

    if (action === 'login') {
      const index = (await readJson(indexPath)) || { keys: {} };
      return Response.json({ ok: true, isNew, index });
    }

    if (action === 'down') {
      const keys = Array.isArray(body.keys) ? body.keys.filter(validKey).slice(0, 200) : [];
      if (!keys.length) return Response.json({ ok: true, urls: {} });
      const res = await fetch(`${URL_BASE}/storage/v1/object/sign/${BUCKET}`, {
        method: 'POST',
        headers: auth({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: SIGN_SECONDS, paths: keys.map((k) => `u/${uid}/d/${k}.json`) }),
      });
      if (!res.ok) throw new Error(`주소 발급 실패 ${res.status}`);
      const arr = await res.json();
      const urls = {};
      arr.forEach((it, i) => { if (it.signedURL) urls[keys[i]] = `${URL_BASE}/storage/v1${it.signedURL}`; });
      return Response.json({ ok: true, urls });
    }

    if (action === 'up') {
      const key = body.key;
      if (!validKey(key)) return Response.json({ error: '잘못된 칸 이름' }, { status: 400 });
      const size = Number(body.size) || 0;
      const index = (await readJson(indexPath)) || { keys: {} };
      const prev = index.keys[key];
      // 내용이 눈에 띄게 줄어드는 저장이면 예전 것을 먼저 남겨 둔다
      if (prev && size < prev.size * 0.8) await backupKey(uid, key);
      const res = await fetch(`${URL_BASE}/storage/v1/object/upload/sign/${BUCKET}/u/${uid}/d/${key}.json`, {
        method: 'POST', headers: auth({ 'x-upsert': 'true' }),
      });
      if (!res.ok) throw new Error(`올리기 주소 발급 실패 ${res.status}`);
      const { url } = await res.json();
      return Response.json({ ok: true, url: `${URL_BASE}/storage/v1${url}` });
    }

    if (action === 'commit') {
      const key = body.key;
      if (!validKey(key)) return Response.json({ error: '잘못된 칸 이름' }, { status: 400 });
      const index = (await readJson(indexPath)) || { keys: {} };
      index.keys[key] = { h: String(body.hash || ''), size: Number(body.size) || 0, t: body.savedAt || new Date().toISOString() };
      index.updatedAt = new Date().toISOString();
      await writeJson(indexPath, index);
      return Response.json({ ok: true });
    }

    if (action === 'del') {
      const key = body.key;
      if (!validKey(key)) return Response.json({ error: '잘못된 칸 이름' }, { status: 400 });
      const index = (await readJson(indexPath)) || { keys: {} };
      if (index.keys[key]) {
        await backupKey(uid, key);
        await deleteObjs([`u/${uid}/d/${key}.json`]);
        delete index.keys[key];
        index.updatedAt = new Date().toISOString();
        await writeJson(indexPath, index);
      }
      return Response.json({ ok: true });
    }

    if (action === 'wipe') {
      const names = await listObj(`u/${uid}/d`);
      const stamp = Date.now();
      for (const n of names) await copyObj(`u/${uid}/d/${n}`, `u/${uid}/b/_wipe_${stamp}/${n}`);
      await deleteObjs(names.map((n) => `u/${uid}/d/${n}`));
      await writeJson(indexPath, { keys: {}, updatedAt: new Date().toISOString() });
      return Response.json({ ok: true, removed: names.length });
    }

    return Response.json({ error: '알 수 없는 요청' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message || '서버 오류' }, { status: 500 });
  }
}
