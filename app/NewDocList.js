'use client';

import { useEffect, useState } from 'react';
import { NEW_DOCS, classList } from '../lib/newdocs';
import { loadForm } from '../lib/store';

// '서류 새로 만들기' 2단계 — 기본사항으로 만들 수 있는 서류 목록
export default function NewDocList({ onSelect, onBasic, onGate, onHome, onAll }) {
  const [basic, setBasic] = useState(null);

  useEffect(() => { loadForm('basic-info').then((b) => setBasic(b || {})); }, []);

  const cls = classList(basic);
  const kids = cls.reduce((n, c) => n + (c.children?.length || 0), 0);
  const hasBasic = !!basic?.centerName?.trim();

  return (
    <div className="wrap">
      <button className="back" onClick={onBasic}>← 기본사항 고치기</button>

      <div className="basic-hero">
        <div className="basic-tag">서류 새로 만들기 · 2단계</div>
        <h1>기본사항으로 서류 만들기</h1>
        <p>
          <b>가진 자료가 없어도 됩니다.</b> 등록한 어린이집·교직원·반·원아 정보로<br />
          필요한 서류를 <b>처음부터 만들어</b> PDF로 저장합니다.
        </p>
      </div>

      {hasBasic ? (
        <div className="newbase">
          <span className="newbase-ok">✓ 등록된 기본사항</span>
          <span><b>{basic.centerName}</b></span>
          <span>교직원 {basic.staff?.length || 0}명</span>
          <span>반 {cls.length}개</span>
          <span>원아 {kids}명</span>
          <button onClick={onBasic}>고치기</button>
        </div>
      ) : (
        <div className="newbase warn">
          <span>⚠️ 기본사항이 아직 없습니다. 어린이집 이름과 반·원아를 먼저 등록해 주세요.</span>
          <button onClick={onBasic}>기본사항 등록하러 가기</button>
        </div>
      )}

      <div className="card">
        <h3 className="card-title" style={{ color: '#1F6FB2' }}>📄 새로 만들 수 있는 서류</h3>
        <div className="newdoc-grid">
          {NEW_DOCS.map((d) => (
            <div key={d.id} className={`newdoc-card ${d.ready ? '' : 'soon'}`}>
              <div className="newdoc-top">
                <span className="newdoc-name">{d.name}</span>
                {d.ready ? <span className="newdoc-badge">만들 수 있음</span> : <span className="newdoc-badge soon">준비 중</span>}
              </div>
              <div className="newdoc-meta">{d.area} · {d.freq}</div>
              {d.desc && <p className="newdoc-desc">{d.desc}</p>}
              {d.makes && (
                <ul className="newdoc-makes">
                  {d.makes.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
              {d.ready && (
                <button className="primary" onClick={() => onSelect(d)}>이 서류 만들기 →</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ color: '#1F6FB2' }}>📚 다 만드셨나요?</h3>
        <p className="hint">
          만드신 서류를 <b>표지 · 운영 목표 · 연간일정</b>과 함께 <b>한 권으로</b> 묶어 드립니다.
          영역별로 순서대로 정리되어 그대로 제출하실 수 있습니다.
        </p>
        <button className="next-doc" onClick={onAll}>📚 전체 서류 하나로 묶기 →</button>
      </div>

      <div className="step-nav">
        <button className="ghost" onClick={onGate}>← 서류 만드는 방식 다시 고르기</button>
        <button className="ghost" onClick={onHome}>첫 화면으로</button>
      </div>
    </div>
  );
}
