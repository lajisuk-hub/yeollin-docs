'use client';

// 정리할 분기 고르기 — 기관마다 정리 기간이 달라(25년 3·4분기 ~ 26년 1·2분기 등)
// 임의로 정하지 않고 원장님이 직접 고른다. (2026-08-19 추가)
import { QUARTER_OPTIONS, DEFAULT_PICKS, sortPicks, makeMeetings } from '../lib/committeeDoc';

export default function QuarterPicker({ picks, onChange, lead }) {
  const cur = sortPicks(picks);
  const list = makeMeetings(cur);
  const years = Array.from(new Set(QUARTER_OPTIONS.map((x) => x.year)));

  const toggle = (k) => {
    if (cur.includes(k)) {
      if (cur.length <= 1) return;            // 마지막 하나는 남겨 둔다
      onChange(cur.filter((x) => x !== k));
    } else {
      onChange(sortPicks([...cur, k]));
    }
  };

  return (
    <div className="card wiz-card">
      <h2 className="wiz-sub">정리할 분기 고르기</h2>
      <p className="hint">
        {lead || '우리 원이 정리해야 하는 분기를 눌러서 고르세요.'} 고른 분기가 <b>1차 · 2차 …</b> 순서로 만들어집니다.
        (분기는 어린이집 회계연도 기준 — 1분기 3월, 2분기 6~8월, 3분기 9~11월, 4분기 12~2월)
      </p>

      <div className="qp-years">
        {years.map((y) => (
          <div className="qp-year" key={y}>
            <b>{y}년</b>
            <div className="qp-row">
              {QUARTER_OPTIONS.filter((o) => o.year === y).map((o) => {
                const n = cur.indexOf(o.key);
                return (
                  <button type="button" key={o.key} className={`qp-btn ${n >= 0 ? 'on' : ''}`} onClick={() => toggle(o.key)}>
                    <span className="qp-top">
                      <b>{o.qn}분기</b>
                      {n >= 0 && <span className="qp-no">{n + 1}차</span>}
                    </span>
                    <em>{o.when}</em>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="qp-sum">
        고른 분기 <b>{cur.length}개</b> · {list.map((m) => `${m.no} ${m.quarter}`).join('  →  ')}
      </p>
      {cur.length !== 4 && (
        <p className="hint" style={{ color: '#b3620a' }}>
          ※ 열린어린이집 심사는 <b>분기별 1회(연 4회)</b>를 봅니다. 특별한 이유가 없으면 <b>네 분기</b>를 골라 주세요.
        </p>
      )}
      <button type="button" className="ghost sm" onClick={() => onChange([...DEFAULT_PICKS])}>
        최근 1년(25년 4분기 ~ 26년 3분기)으로 되돌리기
      </button>
    </div>
  );
}
