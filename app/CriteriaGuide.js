'use client';

import { CRITERIA } from '../lib/docs';

// 첫 페이지: 열린어린이집 심사기준을 보기 좋게 안내 (배점 + 중요 횟수 강조)
export default function CriteriaGuide() {
  return (
    <div className="guide">
      <div className="score-banner">
        <div className="score-big"><b>총 100점</b> 중 <b>80점 이상</b>이면 열린어린이집 선정</div>
        <div className="score-sub">영역별 최소점수도 넘어야 해요 · 개방성 25 · 참여성 25 · 다양성 5 · 지자체 5</div>
      </div>

      {CRITERIA.map((c) => (
        <div key={c.id} className="crit-area" style={{ '--c': c.color }}>
          <div className="crit-head">
            <span className="crit-name">{c.area}</span>
            <span className="crit-pt">{c.points}점</span>
          </div>
          <div className="crit-items">
            {c.items.map((it, i) => (
              <div key={i} className="crit-item">
                <div className="crit-item-top">
                  <span className="crit-item-name">{it.name}</span>
                  <span className="crit-item-pt">{it.pt}점</span>
                </div>
                <div className="crit-badges">
                  <span className="badge-freq">📅 {it.freq}</span>
                </div>
                {it.note && <div className="crit-note">{it.note}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
