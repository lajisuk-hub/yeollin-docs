'use client';

// 왼쪽 아래에 작게 떠 있는 '서버 저장 상태' 표시 (2026-10-07). 인쇄에는 나오지 않는다.
//  ☁ 서버 저장됨 12:31 / ☁ 올리는 중… / ⚠ 서버 저장 안 됨 / (연결 안 함) 이 브라우저에만 저장 중
import { useEffect, useState } from 'react';
import { getMe, getStatus, unskipLogin, loginSkipped, maskPhone } from '../lib/sync';

function hhmm(iso) {
  try { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return ''; }
}

export default function SyncBadge() {
  const [st, setSt] = useState(null);
  const [me, setMeState] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    setMeState(getMe());
    setSt(getStatus());
    const on = (e) => {
      setSt(e.detail);
      if (e.detail.state === 'saved') setLastSaved(e.detail.at);
      setMeState(getMe());
    };
    window.addEventListener('yeollin-sync', on);
    return () => window.removeEventListener('yeollin-sync', on);
  }, []);

  if (!st) return null;

  if (!me) {
    if (!loginSkipped()) return null; // 연결 화면이 떠 있을 때는 표시하지 않는다
    return (
      <button type="button" className="sync-badge off" onClick={() => { unskipLogin(); window.location.reload(); }} title="전화번호·이름으로 서버에도 저장하기">
        💾 이 브라우저에만 저장 중 · <u>서버 저장 연결하기</u>
      </button>
    );
  }

  let cls = 'ok'; let text = `☁ 서버 저장 연결됨 · ${maskPhone(me.phone)}`;
  if (st.state === 'loading') { cls = 'busy'; text = '☁ 서버에서 불러오는 중…'; }
  else if (st.state === 'saving') { cls = 'busy'; text = '☁ 서버에 올리는 중…'; }
  else if (st.state === 'saved' || (st.state === 'idle' && lastSaved)) { text = `☁ 서버 저장됨 ${hhmm(lastSaved || st.at)}`; }
  else if (st.state === 'error') { cls = 'err'; text = `⚠ ${st.detail || '서버 저장 안 됨'} (이 브라우저에는 저장됨)`; }

  return <div className={`sync-badge ${cls}`}>{text}</div>;
}
