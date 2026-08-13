'use client';

import { useState } from 'react';
import { AREAS } from '../lib/docs';
import DocForm from './DocForm';
import StepPage from './StepPage';
import HomeGuide from './HomeGuide';

const STEP_IDS = ['open', 'join', 'diverse'];

export default function Home() {
  // view: {type:'home'} | {type:'step', areaId} | {type:'doc', doc}
  const [view, setView] = useState({ type: 'home' });

  if (view.type === 'doc') {
    // 문서 작성 후 뒤로가면 그 문서가 속한 단계로 돌아감
    return <DocForm doc={view.doc} onBack={() => setView({ type: 'step', areaId: view.doc.area })} />;
  }

  if (view.type === 'step') {
    return (
      <StepPage
        areaId={view.areaId}
        onSelectDoc={(doc) => setView({ type: 'doc', doc })}
        onGo={(areaId) => { setView({ type: 'step', areaId }); window.scrollTo(0, 0); }}
        onHome={() => { setView({ type: 'home' }); window.scrollTo(0, 0); }}
      />
    );
  }

  // ── 첫 페이지: 심사기준 안내 ──
  return (
    <div className="wrap">
      <header className="hero">
        <h1>열린어린이집 문서 도우미</h1>
        <p>먼저 <b>심사기준</b>을 확인하고, <b>개방성 → 참여성 → 다양성</b> 순서로<br />단계별로 필요한 서류를 만들어 <b>PDF로 저장</b>하세요.</p>
      </header>

      <div className="intro">
        <p>📌 아래 <b>1 → 2 → 3</b> 순서로 확인하세요. ① 무엇을 몇 번 만들어야 하는지, ② 우리 지역 기준은 어떤지, ③ 최소 선정기준을 넘는지 검토한 뒤, <b>개방성부터 순서대로</b> 문서를 만들면 됩니다.</p>
        <p className="intro-src">※ 교육부 「열린어린이집 선정·운영 기준」 기반</p>
      </div>

      <HomeGuide />

      {/* 시작하기 */}
      <div className="start-box">
        <h3>이제 문서를 만들어 볼까요?</h3>
        <p>1단계 개방성부터 차례로 진행합니다.</p>
        <button className="start-btn" onClick={() => { setView({ type: 'step', areaId: 'open' }); window.scrollTo(0, 0); }}>
          1단계 · 개방성부터 시작하기 →
        </button>
        <div className="start-jump">
          바로 이동:
          {STEP_IDS.map((id, i) => {
            const a = AREAS.find((x) => x.id === id);
            return (
              <button key={id} className="jump-chip" onClick={() => { setView({ type: 'step', areaId: id }); window.scrollTo(0, 0); }} style={{ '--c': a.color }}>
                {i + 1}. {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <footer className="foot">
        <p>2026 열린어린이집 선정·운영 기준(교육부) 기반 · 만든 서류는 어린이집에서 보관·제출용으로 사용하세요.</p>
      </footer>
    </div>
  );
}
