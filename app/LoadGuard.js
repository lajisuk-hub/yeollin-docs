'use client';

import { useEffect, useState } from 'react';
import { hasLoadFailure } from '../lib/store';

// 저장해 둔 자료를 못 읽었을 때 화면 맨 위에 알림.
// (그 칸은 저장을 멈춰 두었으므로 원래 자료는 지워지지 않는다 — lib/store.js)
export default function LoadGuard() {
  const [fail, setFail] = useState(false);

  useEffect(() => {
    const onFail = () => setFail(true);
    window.addEventListener('yeollin-load-failed', onFail);
    if (hasLoadFailure()) setFail(true);
    return () => window.removeEventListener('yeollin-load-failed', onFail);
  }, []);

  if (!fail) return null;
  return (
    <div className="load-fail-band">
      ⚠️ <b>저장해 둔 자료를 불러오지 못했어요.</b> 원래 자료가 지워지지 않도록 <b>지금은 저장을 멈춰 두었어요.</b>
      {' '}이 도우미가 다른 창(탭)에도 열려 있으면 닫고 <b>새로고침</b>해 주세요.
      <button onClick={() => window.location.reload()}>새로고침</button>
    </div>
  );
}
