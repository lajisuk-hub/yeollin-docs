'use client';

import { useLayoutEffect, useRef } from 'react';

// 원장님이 입력한 줄바꿈을 그대로 살려서 보여준다 (빈 줄은 한 칸 띄우기)
function Lines({ text }) {
  const lines = String(text || '').split(/\r?\n/);
  return (
    <>
      {lines.map((t, i) => (t.trim() ? <p key={i}>{t}</p> : <span key={i} className="nb-gap" />))}
    </>
  );
}

// 배경 그림 안 빈 칸에 글자가 꽉 차도록 크기를 맞춘다 (짧으면 키우고, 길면 줄인다)
// minBottom — 글이 넘칠 때 칸을 아래로 늘릴 수 있는 한계.
// 게시용 안내문처럼 그림 아래쪽에 그림이 있는 서식은 늘리지 말고 글자를 줄여야 한다.
function useFitText(wrapRef, areaRef, nameRef, scale, top, bottom, deps, minBottom = 8) {
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const area = areaRef.current;
    if (!wrap || !area) return;
    const fit = () => {
      const w = wrap.clientWidth || 780;
      const h = wrap.clientHeight || 1040;
      // 어린이집 이름 크기 (위치는 글 칸이 정해진 뒤 아래에서 계산)
      if (nameRef?.current) nameRef.current.style.fontSize = `${w * 0.034}px`;
      const put = (s) => { area.style.fontSize = `${s}px`; };
      const over = () => area.scrollHeight > area.clientHeight + 1;
      // 글 시작 위치는 원장님이 정한 그대로 둔다 (글자 크기와 섞이지 않게)
      area.style.top = `${top}%`;
      let bottomPct = bottom;
      area.style.bottom = `${bottomPct}%`;
      let size = w * 0.030;
      put(size);
      // ① 자리가 남으면 키운다
      let guard = 0;
      while (!over() && size < w * 0.09 && guard < 90) { size *= 1.03; put(size); guard += 1; }
      // ② 넘치면 줄인다
      guard = 0;
      while (over() && size > w * 0.012 && guard < 120) { size *= 0.975; put(size); guard += 1; }
      // ③ 원장님이 정한 글자 크기(%)를 적용한다
      size *= (scale || 1);
      put(size);
      // ④ 넘치면 글 칸을 아래로 늘린다 (시작 위치는 그대로)
      guard = 0;
      while (over() && bottomPct > minBottom && guard < 40) {
        bottomPct -= 1; area.style.bottom = `${bottomPct}%`; guard += 1;
      }
      // ⑤ 그래도 넘치면 이름을 침범하지 않도록 조금 줄인다
      guard = 0;
      while (over() && size > w * 0.012 && guard < 120) { size *= 0.98; put(size); guard += 1; }
      // 어린이집 이름은 글 칸 바로 아래에
      if (nameRef?.current) {
        const n = nameRef.current;
        n.style.bottom = `${Math.max(0.6, ((h * (bottomPct / 100) - n.offsetHeight - h * 0.026) / h) * 100)}%`;
      }
      // ⑥ 마지막으로 픽셀 크기를 '그림 폭에 대한 비율'로 바꿔 둔다.
      //    인쇄할 때처럼 그림 폭이 달라져도 글자가 함께 줄어들어 삐져나오지 않는다.
      area.style.fontSize = `${(size / w) * 100}cqw`;
      if (nameRef?.current) nameRef.current.style.fontSize = '3.4cqw';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    const img = wrap.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', fit, { once: true });
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// 배경 그림 위에 얹는 부모상담 신청서 (부모가 손으로 적는 서식)
function ApplyOnImage({ b }) {
  const wrapRef = useRef(null);
  const areaRef = useRef(null);
  const nameRef = useRef(null);
  useFitText(wrapRef, areaRef, nameRef, b.textScale, b.top, b.bottom, [b.intro, b.topics, b.bg, b.top, b.bottom, b.textScale, b.period]);

  const Line = ({ label, wide }) => (
    <div className={`ap-line ${wide ? 'wide' : ''}`}><span className="ap-label">{label}</span><span className="ap-blank" /></div>
  );

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <img className="nb-img" src={b.bg} alt="" />
      <div className="nb-area ap-area" ref={areaRef} style={{ top: `${b.top}%`, bottom: `${b.bottom}%` }}>
        {b.intro && <div className="ap-intro"><Lines text={b.intro} /></div>}

        <div className="ap-grid">
          <Line label="반 이름" />
          <Line label="영유아 이름" />
          <Line label="보호자 성함 (관계)" />
          <Line label="연락처" />
        </div>

        <div className="ap-box">
          <div className="ap-box-title">상담 희망 일시</div>
          <div className="ap-when">
            <span>1지망</span><b>　　월　　일　　시　　분</b>
            <span>2지망</span><b>　　월　　일　　시　　분</b>
          </div>
          <div className="ap-method">
            <span className="ap-box-title">희망 상담 방법</span>
            <label>□ 대면 상담</label>
            <label>□ 전화 상담</label>
          </div>
          {b.period && <div className="ap-period">※ 상담 기간 : {b.period}{b.place ? ` / ${b.place}` : ''}</div>}
        </div>

        <div className="ap-box">
          <div className="ap-box-title">상담에서 나누고 싶은 내용 <em>(해당하는 곳에 ∨ 표시해 주세요)</em></div>
          <ul className="ap-topics">
            {(b.topics || []).map((t, i) => <li key={i}>□ {t}</li>)}
          </ul>
        </div>

        <div className="ap-free">
          <div className="ap-box-title">더 하고 싶은 이야기</div>
          <span /><span />
        </div>
      </div>
      <div className="nb-name" ref={nameRef}>{b.center}</div>
    </div>
  );
}

// 배경 그림 위에 글을 얹는 안내문
// (원장님이 만든 서식 그림을 그대로 쓰고, 빈 곳에 글자만 넣는다. 글이 길면 글자가 자동으로 작아진다)
function NoticeOnImage({ b }) {
  const wrapRef = useRef(null);
  const areaRef = useRef(null);
  const nameRef = useRef(null);
  const items = b.items || [];
  const notes = b.notes || [];
  const questions = b.questions || [];

  useFitText(
    wrapRef, areaRef, nameRef, b.textScale, b.top, b.bottom,
    [b.greeting, b.items, b.notes, b.questions, b.bg, b.top, b.bottom, b.textScale],
    // 게시용(airy) 서식은 아래 그림을 침범하지 않도록 칸을 늘리지 않는다
    b.airy ? (b.bottom ?? 8) : 8,
  );

  return (
    <div className={`nb-wrap ${b.narrow ? 'narrow' : ''} ${b.airy ? 'airy' : ''}`} ref={wrapRef}>
      <img className="nb-img" src={b.bg} alt="" />
      <div className="nb-area" ref={areaRef} style={{ top: `${b.top}%`, bottom: `${b.bottom}%` }}>
        <div className="nb-greet"><Lines text={b.greeting} /></div>
        {!!items.length && (
          <ul className="nb-items">
            {items.map((it, i) => (
              <li key={i}>
                {it.label && <b>{it.label}</b>}
                <span>{it.value}</span>
              </li>
            ))}
          </ul>
        )}
        {!!questions.length && (
          <div className="nb-ask">
            <div className="nb-ask-title">상담 전, 이런 점을 생각해 오시면 좋아요</div>
            <ol>{questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          </div>
        )}
        {!!notes.length && (
          <div className="nb-notes">{notes.map((n, i) => <p key={i}>※ {n}</p>)}</div>
        )}
      </div>
      <div className="nb-name" ref={nameRef}>{b.center}</div>
    </div>
  );
}

// 안내문에 쓰는 작은 선 아이콘들
const ICONS = {
  calendar: <><rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M3 8h14M7 2.5v3M13 2.5v3" /></>,
  people: <><circle cx="7" cy="7.5" r="2.6" /><circle cx="13.5" cy="8" r="2.2" /><path d="M2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4M12 12.4c1.9-.3 3.7.9 4.4 3.6" /></>,
  clock: <><circle cx="10" cy="10" r="7.2" /><path d="M10 5.6V10l3 2" /></>,
  pin: <><path d="M10 17.5s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9z" /><circle cx="10" cy="8.4" r="2.1" /></>,
  doc: <><path d="M5 2.8h6.5L15 6.3v11H5z" /><path d="M11 2.8v3.6h4M7.4 10h5.2M7.4 13h5.2" /></>,
  dot: <><circle cx="10" cy="10" r="3.4" /></>,
};

function Leaf({ flip }) {
  return (
    <svg className={`np-leaf ${flip ? 'flip' : ''}`} viewBox="0 0 34 22" aria-hidden>
      <g fill="none" stroke="#8fbf6a" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 19C10 19 17 15 22 6" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${7 + i * 4.4} ${17 - i * 2.6} q3.4 -4 8 -3.4`} />
        ))}
      </g>
    </svg>
  );
}

function NoticePoster({ b }) {
  return (
    <div className="notice-poster">
      <div className="np-band" />
      <div className="np-inner">
        <div className="np-eyebrow"><Leaf /><span>{b.eyebrow}</span><Leaf flip /></div>

        <h2 className="np-title">
          <span className="np-round">{b.round}</span>
          <span className="np-main">부모 개별상담 <em>안내</em></span>
        </h2>

        <div className="np-greet"><Lines text={b.greeting} /></div>

        <div className="np-cols">
          <section className="np-card info">
            <h3><span className="np-badge yellow">♥</span>상담 안내</h3>
            <ul>
              {(b.items || []).map((it, i) => (
                <li key={i}>
                  <span className="np-ico yellow">
                    <svg viewBox="0 0 20 20" fill="none" stroke="#c99400" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ICONS[it.icon] || ICONS.dot}</svg>
                  </span>
                  <span className="np-itext">{it.label && <b>{it.label}</b>}{it.value}</span>
                </li>
              ))}
            </ul>
            {!!(b.notes || []).length && (
              <div className="np-notes">
                {b.notes.map((n, i) => <p key={i}>※ {n}</p>)}
              </div>
            )}
          </section>

          <section className="np-card ask">
            <h3><span className="np-badge green">🌱</span>상담 전, 생각해 오시면 좋아요</h3>
            <ol>
              {(b.questions || []).map((q, i) => (
                <li key={i}><span className="np-num">{i + 1}</span><span>{q}</span></li>
              ))}
            </ol>
          </section>
        </div>

        <section className="np-close">
          <svg className="np-house" viewBox="0 0 90 70" aria-hidden>
            <g fill="none" stroke="#7cb342" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 32 45 12l31 20" />
              <path d="M20 32v28h50V32" />
              <path d="M45 12V5h9v5" />
              <circle cx="45" cy="42" r="6" />
              <path d="M45 38.5V42l2.5 1.5" />
              <path d="M30 60V48h9v12M58 60V48h8v12" />
              <path d="M8 60h74" />
              <path d="M10 60c0-6 3-9 6-9s6 3 6 9M74 60c0-6 3-9 6-9" />
            </g>
          </svg>
          <div className="np-close-body">
            <h4>가정과 어린이집이 함께 바라볼 때<br />아이를 더 깊이 이해할 수 있습니다.</h4>
            <p>
              부모님이 알고 계신 가정에서의 아이와 교사가 관찰한 어린이집에서의 아이 모습을 연결하여,
              우리 아이가 지금 어떻게 자라고 있는지와 앞으로 어떤 도움이 필요한지를 함께 찾아가는 따뜻한 상담 시간이 되겠습니다.
            </p>
          </div>
          <div className="np-tag">
            <svg viewBox="0 0 46 40" aria-hidden>
              <g fill="none" stroke="#7cb342" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 16c0-4 3-6.5 6-6.5S35 12 35 16c0 5-8 9.5-12 12.5C19 25.5 11 21 11 16c0-4 3-6.5 6-6.5S23 12 23 16z" />
                <path d="M6 36c1-6 4-9 7-10M40 36c-1-6-4-9-7-10" />
              </g>
            </svg>
            <span>아이의 오늘을 함께 바라보고<br />성장의 내일을 함께 만들어가는 곳</span>
          </div>
        </section>

        <div className="np-foot"><Leaf /><span>{b.center}</span><Leaf flip /></div>
      </div>
    </div>
  );
}

// '서류 새로 만들기' 쪽 미리보기 블록 렌더러 (기존 분석·정리 화면과 별개)
// ── 회칙: 장 → 조 → 항 → 호 단계마다 글씨 크기를 달리해 읽기 쉽게 ──
function RulesDoc({ text }) {
  const lines = String(text || '').split('\n');
  return (
    <div className="rules-doc">
      {lines.map((raw, i) => {
        const t = raw.trim();
        if (!t) return <div className="rd-gap" key={i} />;
        if (/^제\s*\d+\s*장/.test(t) || t === '부칙') return <h4 className="rd-chapter" key={i}>{t}</h4>;
        if (/^제\s*\d+\s*조/.test(t)) {
          const m = t.match(/^(제\s*\d+\s*조\s*\([^)]*\))\s*([\s\S]*)$/);
          return (
            <p className="rd-article" key={i}>
              <b>{m ? m[1] : t}</b>{m && m[2] ? <span> {m[2]}</span> : null}
            </p>
          );
        }
        if (/^[①-⑳]/.test(t)) return <p className="rd-clause" key={i}>{t}</p>;
        if (/^\d+\./.test(t)) return <p className="rd-item" key={i}>{t}</p>;
        // 맨 위 제목줄과 제정일
        if (i === 0) return <p className="rd-title" key={i}>{t}</p>;
        if (/^제정/.test(t)) return <p className="rd-date" key={i}>{t}</p>;
        return <p className="rd-body" key={i}>{t}</p>;
      })}
    </div>
  );
}

// ── 공지문·회의록·결과보고서를 테두리 있는 한 덩어리 문서로 ──
// tight — 전체 문서에서 쪽수를 줄이려고 글자·여백을 조금 작게 (내용은 그대로)
function DocBox({ title, children, tight }) {
  return (
    <div className={`docbox ${tight ? 'tight' : ''}`}>
      <div className="docbox-head">{title}</div>
      <div className="docbox-body">{children}</div>
    </div>
  );
}

const InfoTable = ({ rows }) => (
  <table className="doc-kv box-kv">
    <tbody>
      {(rows || []).filter(([, v]) => v !== undefined).map(([k, v], i) => (
        <tr key={i}><th>{k}</th><td>{v}</td></tr>
      ))}
    </tbody>
  </table>
);

const Paras = ({ text, cls = 'doc-para' }) =>
  String(text || '').split(/\n+/).filter(Boolean).map((t, i) => <p className={cls} key={i}>{t}</p>);

// ── 부모만족도 결과보고서용 ──
// 항목별 평균 점수 막대그래프 (5점 만점). 원장님 결과자료 서식과 같은 모양.
function Bars({ items, total }) {
  const H = 150, TOP = 22, BOT = 26, W = 100;
  const y = (v) => TOP + (H - TOP - BOT) * (1 - Math.min(5, Math.max(0, v)) / 5);
  const grid = [0, 1, 2, 3, 4, 5];
  const list = (items || []).filter((x) => x && x.value > 0);
  const chart = (arr, width, showLegend) => {
    const step = width / (arr.length + 0.4);
    const bw = Math.min(26, step * 0.5);
    return (
      <svg className="bars-svg" viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="xMidYMid meet">
        {grid.map((g) => (
          <g key={g}>
            <line x1="16" x2={width - 4} y1={y(g)} y2={y(g)} stroke="#e2e6e5" strokeWidth="1" />
            <text x="12" y={y(g) + 3.5} textAnchor="end" fontSize="8" fill="#6b7975">{g}</text>
          </g>
        ))}
        <line x1="16" x2="16" y1={TOP - 6} y2={y(0)} stroke="#c3cbc9" strokeWidth="1" />
        {arr.map((it, i) => {
          const cx = 16 + step * (i + 0.7);
          return (
            <g key={i}>
              <rect x={cx - bw / 2} y={y(it.value)} width={bw} height={y(0) - y(it.value)} fill={it.color} />
              <text x={cx} y={y(it.value) - 4} textAnchor="middle" fontSize="8.5" fill="#333">{Number(it.value).toFixed(1)}</text>
              {!showLegend && <text x={cx} y={H - 8} textAnchor="middle" fontSize="8.5" fill="#444">{it.name}</text>}
            </g>
          );
        })}
      </svg>
    );
  };
  return (
    <div className="bars-wrap">
      <div className="bars-box">
        {chart(list, 260, true)}
        <div className="bars-legend">
          {list.map((it, i) => (
            <span key={i}><i style={{ background: it.color }} />{it.name}</span>
          ))}
        </div>
      </div>
      {total?.value > 0 && (
        <div className="bars-box narrow">
          {chart([total], 120, false)}
        </div>
      )}
    </div>
  );
}

export default function Block({ b }) {
  // 전체 서류 묶음의 표지
  if (b.type === 'cover') {
    return (
      <div className="doc-cover">
        <div className="dc-top">
          <span className="dc-year">{b.year}년</span>
          <h1 className="dc-title">{b.center}<br />열린어린이집 관련 서류</h1>
          <div className="dc-rule" />
        </div>
        <div className="dc-foot">{b.center}</div>
      </div>
    );
  }
  // 영역별 큰 구분 (참여성 / 다양성)
  if (b.type === 'sectionhead') {
    return (
      <div className="doc-sectionhead">
        <span className="ds-area">{b.area}</span>
        <h1>{b.no}. {b.text}</h1>
        {b.pt ? <span className="ds-pt">{b.pt}점</span> : null}
      </div>
    );
  }
  if (b.type === 'title') return <h1 className="doc-title">{b.text}</h1>;
  // 초록 띠 제목 (부모만족도 결과보고서)
  if (b.type === 'greenbar') return <h1 className="doc-greenbar">{b.text}</h1>;
  if (b.type === 'centertitle') return <p className="doc-centertitle">{b.text}</p>;
  // 벽에 붙이는 게시용 안내문 (글씨를 크게)
  if (b.type === 'poster') {
    const lines = (t) => String(t || '').split(/\n+/).filter(Boolean);
    return (
      <div className="doc-poster">
        <div className="dp-band" />
        <h2 className="dp-title">{b.title}</h2>
        {b.lead && <div className="dp-lead">{lines(b.lead).map((t, i) => <p key={i}>{t}</p>)}</div>}
        <ul className="dp-items">
          {(b.items || []).map((it, i) => (
            <li key={i}>
              <span className="dp-label">{it.label}</span>
              <span className="dp-value">{lines(it.value).map((t, n) => <p key={n}>{t}</p>)}</span>
            </li>
          ))}
        </ul>
        {!!(b.notes || []).length && (
          <div className="dp-notes">
            {b.notes.map((n, i) => <p key={i}>※ {n}</p>)}
          </div>
        )}
        <div className="dp-foot">{b.center}</div>
      </div>
    );
  }
  if (b.type === 'bars') return <Bars items={b.items} total={b.total} />;
  // □ 조사기간 : … 처럼 네모 기호로 나열하는 목록
  if (b.type === 'checklist') {
    return (
      <ul className="doc-checklist">
        {(b.items || []).filter((it) => it.value).map((it, i) => (
          <li key={i}>
            <b>□ {it.label} :</b>
            <span>{it.value}</span>
          </li>
        ))}
      </ul>
    );
  }
  // 비고 — 잘된 점 / 개선 의견 (왼쪽 표) + 어린이집 조치사항 (오른쪽 노란 박스)
  if (b.type === 'resultnotes') {
    const lines = (t) => String(t || '').split(/\n+/).filter(Boolean);
    return (
      <div className="doc-notes2">
        <table className="doc-kv notes-tbl">
          <thead><tr><th colSpan={2}>비고</th></tr></thead>
          <tbody>
            <tr>
              <th>잘된 점</th>
              <td>{lines(b.good).map((t, i) => <p key={i}>- {t.replace(/^[-·▪\s]+/, '')}</p>)}</td>
            </tr>
            <tr>
              <th>개선 의견</th>
              <td>{lines(b.improve).map((t, i) => <p key={i}>- {t.replace(/^[-·▪\s]+/, '')}</p>)}</td>
            </tr>
          </tbody>
        </table>
        <div className="notes-action">
          {lines(b.action).map((t, i) => <p key={i}>▪ {t.replace(/^[-·▪\s]+/, '')}</p>)}
          {b.closing && <div className="notes-closing">{lines(b.closing).map((t, i) => <p key={i}>{t}</p>)}</div>}
        </div>
      </div>
    );
  }
  if (b.type === 'rulesdoc') return <RulesDoc text={b.text} />;

  // 개최 공지문 — 인사말 / 안내 표 / 맺음말
  if (b.type === 'noticedoc') {
    return (
      <DocBox title={b.title} tight={b.tight}>
        <Paras text={b.greeting} />
        <InfoTable rows={b.rows} />
        <Paras text={b.closing} />
        {b.center && <p className="docbox-sign">{b.center}</p>}
      </DocBox>
    );
  }

  // 회의록 — 표(일시·장소·간사·참석) + 회의순서/토의 및 의결사항 표 + 서명란
  if (b.type === 'minutesdoc') {
    return (
      <DocBox title={b.title} tight={b.tight}>
        <InfoTable rows={b.info} />
        <table className="doc-table box-table flow-table minutes-table">
          <thead><tr><th style={{ width: '22%' }}>구분</th><th>회 의 내 용</th></tr></thead>
          <tbody>
            {b.order && <tr><th>회의순서</th><td>{b.order}</td></tr>}
            <tr><th>토의 및<br />의결사항</th><td>{b.discussion}</td></tr>
          </tbody>
        </table>
        {b.closing && <p className="doc-para">{b.closing}</p>}
        {!!(b.signRows || []).length && (
          <table className="doc-table box-table">
            <thead><tr><th>구분</th><th>성명</th><th>서명</th></tr></thead>
            <tbody>{b.signRows.map((r, i) => <tr key={i}>{r.map((c, n) => <td key={n}>{c}</td>)}</tr>)}</tbody>
          </table>
        )}
      </DocBox>
    );
  }

  // 실시기록 — 정보표(운영일시·참석자) + 진행 순서 표 + 운영 내용 정리
  if (b.type === 'recorddoc') {
    return (
      <DocBox title={b.title} tight={b.tight}>
        <InfoTable rows={b.info} />
        <table className="doc-table box-table flow-table">
          <thead>
            <tr>{(b.head || []).map((h, i) => <th key={i} style={b.widths ? { width: b.widths[i] } : undefined}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {(b.rows || []).map((r, i) => <tr key={i}>{r.map((c, n) => <td key={n}>{c || ' '}</td>)}</tr>)}
          </tbody>
        </table>
        {(b.sections || []).filter((s) => s.text).map((s, i) => (
          <div className="docbox-part" key={i}>
            <p className="docbox-sub">{s.title}</p>
            <Paras text={s.text} />
          </div>
        ))}
        {b.center && <p className="docbox-sign">{b.center}</p>}
      </DocBox>
    );
  }

  // 회의결과 보고서 — 안건별 표
  if (b.type === 'resultdoc') {
    return (
      <DocBox title={b.title} tight={b.tight}>
        <Paras text={b.intro} />
        <table className="doc-table box-table flow-table">
          <thead><tr><th style={{ width: '28%' }}>안건</th><th>논의·결정 내용</th></tr></thead>
          <tbody>
            {(b.items || []).map((it, i) => (
              <tr key={i}><th>{i + 1}) {it.title}</th><td>{it.body}</td></tr>
            ))}
          </tbody>
        </table>
        {b.closing && <p className="docbox-star">{b.closing}</p>}
        {b.center && <p className="docbox-sign">{b.center}</p>}
      </DocBox>
    );
  }

  if (b.type === 'lead') return <p className="doc-lead">{b.text}</p>;
  if (b.type === 'heading') return <h2 className="doc-heading">{b.text}</h2>;
  if (b.type === 'subheading') return <h3 className="doc-subheading">{b.text}</h3>;
  if (b.type === 'sessionhead') return <h3 className="doc-sessionhead">{b.text}</h3>;
  if (b.type === 'para') {
    const lines = String(b.text || ' ').split(/\n+/);
    return <>{lines.map((t, i) => <p className="doc-para" key={i}>{t || ' '}</p>)}</>;
  }
  if (b.type === 'note') return <p className="doc-note">{b.text}</p>;
  if (b.type === 'pagebreak') return <div className="doc-pagebreak" />;
  if (b.type === 'divider') return <div className="doc-divider" />;
  if (b.type === 'blank') {
    return (
      <div className="doc-blank">
        {Array.from({ length: b.lines || 3 }).map((_, i) => <span key={i} />)}
      </div>
    );
  }
  if (b.type === 'photos') {
    const items = (b.items || []).filter(Boolean);
    if (!items.length) return null;
    return (
      <div className={`doc-photos-wrap ${b.small ? 'small' : ''}`}>
        {b.caption && <div className="doc-photos-cap">{b.caption}</div>}
        <div className="doc-photos">
          {items.map((src, i) => <figure key={i} className="doc-photo"><img src={src} alt="" /></figure>)}
        </div>
      </div>
    );
  }
  // 가정통신문 모양 안내문 (인쇄해서 그대로 나눠줄 수 있는 형태)
  if (b.type === 'notice') return b.bg ? <NoticeOnImage b={b} /> : <NoticePoster b={b} />;
  if (b.type === 'apply') return <ApplyOnImage b={b} />;
  // 서식 두 장을 나란히 (문서에 넣을 때는 크게 볼 필요가 없음)
  if (b.type === 'pair') {
    return (
      <div className={`doc-pair ${b.compact ? 'compact' : ''}`}>
        {(b.items || []).map((it, i) => (
          <div key={i}>
            {b.labels?.[i] && <div className="doc-pair-cap">{b.labels[i]}</div>}
            <Block b={it} />
          </div>
        ))}
      </div>
    );
  }
  // 손으로 적는 서식의 제목 (신청서 등)
  if (b.type === 'formtitle') return <h2 className="doc-formtitle">{b.text}</h2>;
  if (b.type === 'kv') {
    // tall — 손으로 적는 칸이라 줄 높이를 넉넉히
    return (
      <table className={`doc-kv ${b.tall ? 'tall' : ''}`}>
        <tbody>
          {b.rows.map(([label, value], i) => (
            <tr key={i}><th>{label}</th><td>{value || ' '}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (b.type === 'table') {
    // leftFirst — 첫 칸만 왼쪽 정렬 / lastStrong — 마지막 줄 강조 / cls — 표마다 다른 모양
    // 셀은 문자열이거나 {t:'글', rs:합칠 줄 수} 객체. null이면 위 칸에 합쳐진 자리라 그리지 않는다.
    return (
      <table className={`doc-table ${b.leftFirst ? 'left-first' : ''} ${b.cls || ''}`}>
        <thead>
          <tr>{b.head.map((h, i) => <th key={i} style={b.widths ? { width: b.widths[i] } : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i} className={b.lastStrong && i === b.rows.length - 1 ? 'row-strong' : undefined}>
              {r.map((c, j) => {
                if (c === null) return null;
                if (c && typeof c === 'object') {
                  return <th key={j} className="cell-group" rowSpan={c.rs || 1}>{c.t}</th>;
                }
                return <td key={j}>{c || ' '}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (b.type === 'sign') {
    // blank — 손으로 적는 서식(신청서 등). 밑줄 칸을 넉넉히 그려 준다
    if (b.blank) {
      return (
        <div className="doc-sign blankline">
          <div className="doc-sign-date">
            20<span className="sg-u w1" />년<span className="sg-u w1" />월<span className="sg-u w1" />일
          </div>
          <div className="doc-sign-name">
            {b.role}<span className="sg-u w3" /><span className="doc-sign-seal">(인)</span>
          </div>
        </div>
      );
    }
    return (
      <div className="doc-sign">
        <div className="doc-sign-date">{b.date}</div>
        <div className="doc-sign-name">{b.role} {b.name} <span className="doc-sign-seal">(인)</span></div>
      </div>
    );
  }
  return null;
}
