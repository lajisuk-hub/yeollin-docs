'use client';

import { useState, useEffect } from 'react';
import { AREAS, getDoc } from '../lib/docs';
import { saveLocal, loadLocal, clearAll } from '../lib/store';
import DocForm from './DocForm';
import StepPage from './StepPage';
import HomeGuide from './HomeGuide';
import PathGate from './PathGate';
import BasicInfo from './BasicInfo';
import NewDocList from './NewDocList';
import NewDocForm from './NewDocForm';
import CounselWizard from './CounselWizard';
import CommitteeWizard from './CommitteeWizard';
import ProgramWizard from './ProgramWizard';
import SurveyWizard from './SurveyWizard';
import LinkWizard from './LinkWizard';
import VisitWizard from './VisitWizard';
import { getNewDoc } from '../lib/newdocs';

const STEP_IDS = ['open', 'join', 'diverse'];

export default function Home() {
  // view: {type:'home'} | {type:'step', areaId} | {type:'gate'} | {type:'basic'} | {type:'doc', doc}
  const [view, setView] = useState({ type: 'home' });
  // 참여성에 처음 들어갈 때 한 번 '서류 만드는 방식'을 고르게 한다
  const [pathChosen, setPathChosen] = useState(false);
  const [ready, setReady] = useState(false);

  // ── 마지막으로 보던 화면을 그대로 이어서 (같은 브라우저) ──
  useEffect(() => {
    const ui = loadLocal('ui');
    if (ui) {
      if (ui.pathChosen) setPathChosen(true);
      const v = ui.view;
      if (v?.type === 'doc' && v.docId) {
        const d = getDoc(v.docId);
        if (d) setView({ type: 'doc', doc: d });
      } else if (v?.type === 'step' && v.areaId) {
        setView({ type: 'step', areaId: v.areaId });
      } else if (v?.type === 'newdoc' && v.docId) {
        const d = getNewDoc(v.docId);
        if (d) setView({ type: 'newdoc', doc: d });
      } else if (v?.type === 'gate' || v?.type === 'basic' || v?.type === 'newlist') {
        setView({ type: v.type });
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const v = (view.type === 'doc' || view.type === 'newdoc') ? { type: view.type, docId: view.doc.id } : view;
    saveLocal('ui', { view: v, pathChosen });
  }, [view, pathChosen, ready]);

  // 테스트하거나 처음부터 다시 할 때: 이 브라우저에 저장된 내용 전부 삭제
  const resetEverything = async () => {
    if (!window.confirm('이 브라우저에 저장된 작성 내용(문서 입력값·첨부한 사진·기본사항·체크 표시)을 모두 지울까요?\n\n지우면 되돌릴 수 없습니다.')) return;
    await clearAll();
    window.location.reload();
  };

  const go = (next) => { setView(next); window.scrollTo(0, 0); };
  const goHome = () => go({ type: 'home' });
  const goGate = () => go({ type: 'gate' });
  // 참여성부터는 서류 단계 → 방식을 아직 안 골랐으면 갈림길 화면부터
  const goStep = (areaId) => {
    if (areaId === 'join' && !pathChosen) return goGate();
    go({ type: 'step', areaId });
  };

  // 저장된 화면을 불러오는 아주 짧은 순간 (깜빡임 방지)
  if (!ready) return <div className="wrap" />;

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
        onGoDocs={() => go({ type: 'newlist' })}
      />
    );
  }

  // ── 서류 새로 만들기 (기존 분석·정리와 별개 흐름) ──
  if (view.type === 'newlist') {
    return (
      <NewDocList
        onSelect={(d) => go({ type: 'newdoc', doc: d })}
        onBasic={() => go({ type: 'basic' })}
        onGate={goGate}
        onHome={goHome}
      />
    );
  }

  if (view.type === 'newdoc') {
    const back = () => go({ type: 'newlist' });
    // 서류에 따라 한 단계씩 물어보며 만드는 방식 (wizard 값으로 갈라짐)
    if (view.doc.wizard === 'committee') return <CommitteeWizard onBack={back} />;
    if (view.doc.wizard === 'program') return <ProgramWizard onBack={back} />;
    if (view.doc.wizard === 'survey') return <SurveyWizard onBack={back} />;
    if (view.doc.wizard === 'link') return <LinkWizard onBack={back} />;
    if (view.doc.wizard === 'visit') return <VisitWizard onBack={back} />;
    if (view.doc.wizard) return <CounselWizard onBack={back} />;
    return <NewDocForm doc={view.doc} onBack={back} />;
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

      <div className="save-band">
        <p>💾 <b>작성한 내용은 이 컴퓨터(브라우저)에 자동으로 저장됩니다.</b> 새로고침하거나 창을 닫았다 열어도 <b>마지막에 보던 화면과 입력한 내용·사진이 그대로</b> 이어집니다.</p>
        <button className="save-band-reset" onClick={resetEverything}>저장된 내용 전체 지우기</button>
      </div>

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
