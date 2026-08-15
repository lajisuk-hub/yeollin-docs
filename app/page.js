'use client';

import { useState } from 'react';
import { AREAS } from '../lib/docs';
import DocForm from './DocForm';
import StepPage from './StepPage';
import HomeGuide from './HomeGuide';
import PathGate from './PathGate';
import BasicInfo from './BasicInfo';

const STEP_IDS = ['open', 'join', 'diverse'];

export default function Home() {
  // view: {type:'home'} | {type:'step', areaId} | {type:'gate'} | {type:'basic'} | {type:'doc', doc}
  const [view, setView] = useState({ type: 'home' });
  // 참여성에 처음 들어갈 때 한 번 '서류 만드는 방식'을 고르게 한다
  const [pathChosen, setPathChosen] = useState(false);

  const go = (next) => { setView(next); window.scrollTo(0, 0); };
  const goHome = () => go({ type: 'home' });
  const goGate = () => go({ type: 'gate' });
  // 참여성부터는 서류 단계 → 방식을 아직 안 골랐으면 갈림길 화면부터
  const goStep = (areaId) => {
    if (areaId === 'join' && !pathChosen) return goGate();
    go({ type: 'step', areaId });
  };

  if (view.type === 'doc') {
    // 문서 작성 후 뒤로가면 그 문서가 속한 단계로 돌아감
    return <DocForm doc={view.doc} onBack={() => go({ type: 'step', areaId: view.doc.area })} />;
  }

  if (view.type === 'gate') {
    return (
      <PathGate
        onNew={() => { setPathChosen(true); go({ type: 'basic' }); }}
        onExisting={() => { setPathChosen(true); go({ type: 'step', areaId: 'join' }); }}
        onHome={goHome}
      />
    );
  }

  if (view.type === 'basic') {
    return (
      <BasicInfo
        onBack={goGate}
        onHome={goHome}
        onGoDocs={() => go({ type: 'step', areaId: 'join' })}
      />
    );
  }

  if (view.type === 'step') {
    return (
      <StepPage
        areaId={view.areaId}
        onSelectDoc={(doc) => go({ type: 'doc', doc })}
        onGo={goStep}
        onHome={goHome}
        onGate={goGate}
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

      {/* 가장 먼저 읽어야 할 안내 */}
      <section className="notice">
        <div className="notice-head">
          <span className="notice-badge">필독</span>
          <h2>시작하기 전에 꼭 읽어주세요</h2>
        </div>

        <div className="notice-body">
          <p className="notice-maker"><b>영유아교육디자인연구소</b>가 제작한 시스템입니다.</p>
          <p className="notice-use">
            우리 원의 <b>열린어린이집 준비를 위한 문서 정리</b>와,<br />
            <b>기존에 부족했던 문서를 미리 만들어 두기</b> 위한 시스템입니다.
          </p>
        </div>

        <div className="notice-alert">
          <span className="notice-ico">⚠️</span>
          <p><b>유료로 제공되는 시스템입니다.</b> 주위에 <b>무단으로 배포할 경우 500만원의 벌금</b>이 부과될 수 있습니다.</p>
        </div>

        <div className="notice-alert period">
          <span className="notice-ico">🗓️</span>
          <p>열린어린이집 준비를 위해 <b>2026년 12월까지</b> 사용하세요. <b>2027년부터는 사용할 수 없습니다.</b></p>
        </div>
      </section>

      <div className="intro">
        <p>📌 아래 <b>1 → 2 → 3</b> 순서로 확인하세요. ① 무엇을 몇 번 만들어야 하는지, ② 우리 지역 기준은 어떤지, ③ 최소 선정기준을 넘는지 검토한 뒤, <b>개방성부터 순서대로</b> 문서를 만들면 됩니다.</p>
        <p className="intro-src">※ 교육부 「열린어린이집 선정·운영 기준」 기반</p>
      </div>

      <HomeGuide />

      {/* 시작하기 */}
      <div className="start-box">
        <h3>이제 문서를 만들어 볼까요?</h3>
        <p>1단계 개방성부터 차례로 진행합니다.</p>
        <button className="start-btn" onClick={() => go({ type: 'step', areaId: 'open' })}>
          1단계 · 개방성부터 시작하기 →
        </button>
        <div className="start-jump">
          바로 이동:
          {STEP_IDS.map((id, i) => {
            const a = AREAS.find((x) => x.id === id);
            return (
              <button key={id} className="jump-chip" onClick={() => goStep(id)} style={{ '--c': a.color }}>
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
