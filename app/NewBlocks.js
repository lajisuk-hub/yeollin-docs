'use client';

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
  const greetLines = String(b.greeting || '').split(/\n+/).map((t) => t.trim()).filter(Boolean);
  return (
    <div className="notice-poster">
      <div className="np-band" />
      <div className="np-inner">
        <div className="np-eyebrow"><Leaf /><span>{b.eyebrow}</span><Leaf flip /></div>

        <h2 className="np-title">
          <span className="np-round">{b.round}</span>
          <span className="np-main">부모 개별상담 <em>안내</em></span>
        </h2>

        <div className="np-to">(　　　　　　　　　　) 부모님께</div>

        <div className="np-greet">
          {greetLines.map((t, i) => <p key={i}>{t}</p>)}
        </div>

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
  if (b.type === 'notice') return <NoticePoster b={b} />;
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
