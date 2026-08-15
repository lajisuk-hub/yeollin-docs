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
function useFitText(wrapRef, areaRef, nameRef, scale, top, bottom, deps) {
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
      while (!over() && size < w * 0.06 && guard < 80) { size *= 1.03; put(size); guard += 1; }
      // ② 넘치면 줄인다
      guard = 0;
      while (over() && size > w * 0.012 && guard < 120) { size *= 0.975; put(size); guard += 1; }
      // ③ 원장님이 정한 글자 크기(%)를 적용한다
      size *= (scale || 1);
      put(size);
      // ④ 넘치면 글 칸을 아래로 늘린다 (시작 위치는 그대로)
      guard = 0;
      while (over() && bottomPct > 11 && guard < 40) {
        bottomPct -= 1; area.style.bottom = `${bottomPct}%`; guard += 1;
      }
      // ⑤ 그래도 넘치면 이름을 침범하지 않도록 조금 줄인다
      guard = 0;
      while (over() && size > w * 0.012 && guard < 120) { size *= 0.98; put(size); guard += 1; }
      // 어린이집 이름은 글 칸 바로 아래에
      if (nameRef?.current) {
        const n = nameRef.current;
        n.style.bottom = `${Math.max(6, h * (bottomPct / 100) - n.offsetHeight - h * 0.026)}px`;
      }
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

  useFitText(wrapRef, areaRef, nameRef, b.textScale, b.top, b.bottom, [b.greeting, b.items, b.notes, b.questions, b.bg, b.top, b.bottom, b.textScale]);

  return (
    <div className="nb-wrap" ref={wrapRef}>
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
export default function Block({ b }) {
  if (b.type === 'title') return <h1 className="doc-title">{b.text}</h1>;
  if (b.type === 'lead') return <p className="doc-lead">{b.text}</p>;
  if (b.type === 'heading') return <h2 className="doc-heading">{b.text}</h2>;
  if (b.type === 'sessionhead') return <h3 className="doc-sessionhead">{b.text}</h3>;
  if (b.type === 'para') {
    const lines = String(b.text || ' ').split(/\n+/);
    return <>{lines.map((t, i) => <p className="doc-para" key={i}>{t || ' '}</p>)}</>;
  }
  if (b.type === 'note') return <p className="doc-note">{b.text}</p>;
  if (b.type === 'pagebreak') return <div className="doc-pagebreak" />;
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
      <div className="doc-photos-wrap">
        <div className="doc-photos">
          {items.map((src, i) => <figure key={i} className="doc-photo"><img src={src} alt="" /></figure>)}
        </div>
        {b.caption && <div className="doc-photos-cap">{b.caption}</div>}
      </div>
    );
  }
  // 가정통신문 모양 안내문 (인쇄해서 그대로 나눠줄 수 있는 형태)
  if (b.type === 'notice') return b.bg ? <NoticeOnImage b={b} /> : <NoticePoster b={b} />;
  if (b.type === 'apply') return <ApplyOnImage b={b} />;
  if (b.type === 'kv') {
    return (
      <table className="doc-kv">
        <tbody>
          {b.rows.map(([label, value], i) => (
            <tr key={i}><th>{label}</th><td>{value || ' '}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (b.type === 'table') {
    return (
      <table className="doc-table">
        <thead>
          <tr>{b.head.map((h, i) => <th key={i} style={b.widths ? { width: b.widths[i] } : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c || ' '}</td>)}</tr>)}
        </tbody>
      </table>
    );
  }
  if (b.type === 'sign') {
    return (
      <div className="doc-sign">
        <div className="doc-sign-date">{b.date}</div>
        <div className="doc-sign-name">{b.role} {b.name} <span className="doc-sign-seal">(인)</span></div>
      </div>
    );
  }
  return null;
}
