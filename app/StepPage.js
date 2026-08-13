'use client';

import { CRITERIA, docsByArea, AREAS } from '../lib/docs';

const STEP_IDS = ['open', 'join', 'diverse'];

export default function StepPage({ areaId, onSelectDoc, onGo, onHome }) {
  const stepIndex = STEP_IDS.indexOf(areaId);
  const area = AREAS.find((a) => a.id === areaId);
  const crit = CRITERIA.find((c) => c.id === areaId);
  const docs = docsByArea(areaId);
  const color = area.color;

  const prevId = stepIndex > 0 ? STEP_IDS[stepIndex - 1] : null;
  const nextId = stepIndex < STEP_IDS.length - 1 ? STEP_IDS[stepIndex + 1] : null;

  return (
    <div className="wrap">
      <button className="back" onClick={onHome}>← 첫 화면(심사기준)으로</button>

      {/* 단계 표시 */}
      <div className="stepper">
        {STEP_IDS.map((id, i) => {
          const a = AREAS.find((x) => x.id === id);
          const state = i === stepIndex ? 'on' : i < stepIndex ? 'done' : 'todo';
          return (
            <div key={id} className={`step-dot ${state}`} onClick={() => onGo(id)} style={{ '--c': a.color }}>
              <span className="step-num">{i + 1}</span>
              <span className="step-label">{a.label}</span>
            </div>
          );
        })}
      </div>

      <div className="step-hero" style={{ '--c': color }}>
        <div className="step-tag">{stepIndex + 1}단계</div>
        <h1>{crit.area.replace(/^\d+\.\s*/, '')} <span className="step-pt">{crit.points}점</span></h1>
        <p>이 단계에서 <b>꼭 챙겨야 할 항목과 횟수</b>를 먼저 확인하고, 아래에서 <b>필요한 문서를 만들어</b> PDF로 저장하세요.</p>
      </div>

      {/* 꼭 챙길 것: 항목 + 횟수 */}
      <div className="card">
        <h3 className="card-title" style={{ color }}>✅ 꼭 챙겨야 할 것 (항목별 필요 횟수)</h3>
        <table className="need-table">
          <thead>
            <tr><th>항목</th><th>배점</th><th>필요 횟수</th></tr>
          </thead>
          <tbody>
            {crit.items.map((it, i) => (
              <tr key={i}>
                <td>
                  <b>{it.name}</b>
                  {it.note && <div className="need-note">{it.note}</div>}
                </td>
                <td className="need-pt">{it.pt}점</td>
                <td className="need-freq">{it.freq}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 만들 수 있는 문서 */}
      <div className="card">
        <h3 className="card-title" style={{ color }}>📄 여기서 만들 수 있는 문서</h3>
        {docs.length === 0 ? (
          <p className="hint">이 항목은 현장 확인 위주라 별도 문서가 없습니다.</p>
        ) : (
          <div className="doc-grid">
            {docs.map((doc) => (
              <button key={doc.id} className="doc-card" onClick={() => onSelectDoc(doc)} style={{ '--accent': color }}>
                <span className="doc-card-name">{doc.name}</span>
                <span className="doc-card-freq">{doc.freq}</span>
                <span className="doc-card-desc">{doc.desc}</span>
                <span className="doc-card-go">문서 만들기 →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 단계 이동 */}
      <div className="step-nav">
        {prevId ? (
          <button className="ghost" onClick={() => onGo(prevId)}>← 이전 단계</button>
        ) : (
          <button className="ghost" onClick={onHome}>← 심사기준</button>
        )}
        {nextId ? (
          <button className="primary" onClick={() => onGo(nextId)}>다음 단계 →</button>
        ) : (
          <button className="primary" onClick={onHome}>단계 완료 · 처음으로</button>
        )}
      </div>
    </div>
  );
}
