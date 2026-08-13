'use client';

import { CRITERIA, KEY_SCHEDULE, AREAS } from '../lib/docs';
import CriteriaGuide from './CriteriaGuide';

const areaColor = (id) => AREAS.find((a) => a.id === id)?.color || '#6B7280';
const areaLabel = (id) => AREAS.find((a) => a.id === id)?.label || '';

export default function HomeGuide() {
  return (
    <div className="guide">
      {/* ① 중요하게 보는 것: 문서종류와 횟수 */}
      <section className="gsec">
        <h2 className="gsec-title"><span className="gsec-no">1</span> 열린어린이집이 중요하게 보는 것 <small>(꼭 만들어야 하는 서류 · 횟수)</small></h2>
        <p className="gsec-lead">심사에서는 <b>“정해진 서류를 정해진 횟수만큼 만들어 두었는가”</b>를 봅니다. 아래 서류를 <b>1년 동안 빠짐없이</b> 준비하세요. <span className="hl-legend">노랑</span> 표시는 자주 만들어야 해 <b>놓치기 쉬운 것</b>이에요.</p>
        <table className="key-table">
          <thead>
            <tr><th>꼭 만들 서류</th><th>영역</th><th>필요 횟수</th></tr>
          </thead>
          <tbody>
            {KEY_SCHEDULE.map((k, i) => (
              <tr key={i} className={k.emphasize ? 'hot' : ''}>
                <td><b>{k.doc}</b></td>
                <td><span className="area-chip" style={{ background: areaColor(k.area) }}>{areaLabel(k.area)}</span></td>
                <td className="key-freq">{k.yearly}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ② 지자체별 심사기준 */}
      <section className="gsec">
        <h2 className="gsec-title"><span className="gsec-no">2</span> 지자체별 심사기준 안내</h2>
        <div className="local-box">
          <p>💡 열린어린이집 심사는 <b>전국 공통기준(85점)</b> + <b>지자체 자체기준(15점)</b>으로 이루어집니다. 그래서 <b>지역(시·군·구)마다 조금씩 다릅니다.</b></p>
          <ul>
            <li><b>지자체 자체기준 15점</b> — 예) 부모 자율모임 운영 등, 지역마다 항목이 다릅니다.</li>
            <li><b>영역별 최소점수·세부 배점</b>도 지자체가 조정할 수 있습니다.</li>
          </ul>
          <p className="local-do">👉 반드시 <b>우리 어린이집 관할 시·군·구청(보육부서)의 열린어린이집 공고문</b>을 먼저 확인하세요. 이 도우미는 공통기준 서류를 만들어 드리고, 지자체 자체기준은 지역 공고에 맞춰 따로 준비하시면 됩니다.</p>
        </div>
      </section>

      {/* ③ 최소 선정기준 검토 */}
      <section className="gsec">
        <h2 className="gsec-title"><span className="gsec-no">3</span> 최소 선정기준 검토</h2>
        <div className="min-banner">총 <b>100점</b> 중 <b>80점 이상</b> + <b>영역별 최소점수</b>를 모두 넘어야 선정됩니다.</div>
        <table className="min-table">
          <thead>
            <tr><th>영역</th><th>배점</th><th>영역별 최소점수</th></tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c.id}>
                <td><span className="dot" style={{ background: c.color }} /> {c.area.replace(/^\d+\.\s*/, '')}</td>
                <td className="min-pt">{c.points}점</td>
                <td className="min-need">{c.min}점 이상</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="min-hint">※ 어느 한 영역이라도 최소점수에 못 미치면 총점이 높아도 선정되지 않을 수 있어요.</p>
      </section>

      {/* ④ 전체 배점표 (접기) */}
      <details className="full-details">
        <summary>📋 전체 심사기준·배점표 자세히 보기</summary>
        <div style={{ marginTop: 12 }}>
          <CriteriaGuide />
        </div>
      </details>
    </div>
  );
}
