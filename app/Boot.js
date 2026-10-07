'use client';

// 앱을 열 때 맨 먼저 지나는 문 (2026-10-07)
//  · 전화번호+이름이 등록돼 있으면 → 서버 보관함 내용을 먼저 받아 이 브라우저와 맞춘 뒤 화면을 띄운다
//  · 등록이 없으면 → 연결 화면을 보여 준다 ("나중에 하기"로 이 브라우저에만 저장하며 쓸 수도 있다)
// 이게 있어야 다른 컴퓨터·휴대폰·브라우저에서 들어와도 전에 만든 서류가 그대로 이어진다.

import { useEffect, useState } from 'react';
import {
  getMe, setMe, clearMe, pullRemote, loginSkipped, skipLoginThisVisit,
  normalizePhone, validPhone, normalizeName,
} from '../lib/sync';
import { countForms } from '../lib/store';

export default function Boot({ children }) {
  const [phase, setPhase] = useState('loading'); // loading | login | pulling | ready
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [localCount, setLocalCount] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const me = getMe();
    if (me) {
      setPhase('pulling');
      pullRemote().then((r) => {
        if (!r.ok && r.code === 'name') {
          // 등록된 이름과 다르다 — 다시 넣게 한다
          clearMe();
          setPhone(me.phone); setName('');
          setErr('이 전화번호는 다른 이름으로 등록되어 있어요. 처음 연결할 때 쓴 이름을 그대로 넣어 주세요.');
          setPhase('login');
          return;
        }
        setPhase('ready'); // 인터넷이 안 되면 이 브라우저 내용으로 그냥 진행 (저장 표시에 알림)
      });
      return;
    }
    if (loginSkipped()) { setPhase('ready'); return; }
    countForms().then(setLocalCount);
    setPhase('login');
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    const n = normalizeName(name);
    if (!validPhone(p)) { setErr('휴대폰 번호를 숫자만 11자리로 넣어 주세요. 예) 01012345678'); return; }
    if (n.length < 2) { setErr('이름을 두 글자 이상 넣어 주세요.'); return; }
    setErr('');
    setMe({ phone: p, name: n });
    setPhase('pulling');
    const r = await pullRemote();
    if (!r.ok) {
      clearMe();
      setErr(r.code === 'name'
        ? '이 전화번호는 다른 이름으로 등록되어 있어요. 처음 연결할 때 쓴 이름을 그대로 넣어 주세요.'
        : '지금은 서버에 연결할 수 없어요. 인터넷 상태를 확인하고 다시 눌러 주세요. (나중에 하기를 누르면 이 브라우저에만 저장하며 쓸 수 있어요)');
      setPhase('login');
      return;
    }
    if (r.isNew && r.pushed > 0) setNotice(`이 브라우저에 있던 서류 ${r.pushed}건을 서버에 올려 두었어요. 이제 다른 컴퓨터에서도 같은 번호·이름으로 이어서 쓸 수 있어요.`);
    else if (r.pulled > 0) setNotice(`서버에 저장돼 있던 서류 ${r.pulled}건을 불러왔어요.`);
    setPhase('ready');
  };

  const skip = () => { skipLoginThisVisit(); setPhase('ready'); };

  if (phase === 'loading') return <div className="wrap" />;

  if (phase === 'pulling') {
    return (
      <div className="boot-wait">
        <div className="boot-spin" />
        <p>저장해 둔 서류를 불러오는 중입니다…</p>
        <p className="boot-sub">사진이 많으면 조금 걸릴 수 있어요.</p>
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <div className="wrap">
        <div className="boot-card">
          <div className="boot-tag">서류 안전하게 보관하기</div>
          <h1>전화번호와 이름을 넣어 주세요</h1>
          <p className="boot-lead">
            만든 서류와 올린 사진을 <b>서버에도 함께 저장</b>해 드려요.<br />
            그러면 <b>다른 컴퓨터·휴대폰·브라우저</b>에서 들어와도 전에 만든 서류가 그대로 이어집니다.
          </p>
          {localCount > 0 && (
            <p className="boot-local">📂 이 브라우저에 저장된 서류 <b>{localCount}건</b>이 있어요. 연결하면 이 서류들도 서버에 안전하게 올라갑니다.</p>
          )}
          <form onSubmit={submit} className="boot-form">
            <label>
              <span>휴대폰 번호</span>
              <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" autoComplete="tel" />
            </label>
            <label>
              <span>이름</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoComplete="name" />
            </label>
            {err && <p className="boot-err">⚠️ {err}</p>}
            <button type="submit" className="boot-go">연결하고 시작하기 →</button>
          </form>
          <p className="boot-tip">
            ※ 다음부터는 <b>같은 번호와 이름</b>으로 들어오면 이어집니다. 번호를 잘못 넣으면 빈 화면으로 시작되니 한 번 더 확인해 주세요.<br />
            ※ 번호와 이름은 서류를 찾는 열쇠로만 쓰이고, 다른 곳에 쓰이지 않아요.
          </p>
          <button type="button" className="boot-skip" onClick={skip}>나중에 하기 (이 브라우저에만 저장하며 쓰기)</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {notice && (
        <div className="boot-notice">
          ✅ {notice}
          <button type="button" onClick={() => setNotice('')}>닫기</button>
        </div>
      )}
      {children}
    </>
  );
}
