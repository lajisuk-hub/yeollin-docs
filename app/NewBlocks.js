'use client';

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
  // 가정통신문 모양 안내문 (글이 아니라 인쇄해서 그대로 나눠줄 수 있는 형태)
  if (b.type === 'notice') {
    return (
      <div className="notice-poster">
        <div className="np-band" />
        <div className="np-inner">
          <div className="np-titlewrap"><h2 className="np-title">{b.title}</h2></div>
          <div className="np-to">(                    ) 부모님께</div>
          {String(b.greeting || '').split(/\n+/).map((t, i) => t.trim() && <p className="np-greet" key={i}>{t}</p>)}
          <ul className="np-items">
            {(b.items || []).map((it, i) => (
              <li key={i}><span className="np-mark">{it.mark || '◈'}</span>{it.text}</li>
            ))}
          </ul>
          {!!(b.notes || []).length && (
            <div className="np-notes">
              <div className="np-notes-title">&lt;참고사항&gt;</div>
              <ol>
                {b.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ol>
            </div>
          )}
          <div className="np-foot">
            <div className="np-center">{b.center}</div>
            <svg className="np-kids" viewBox="0 0 120 44" aria-hidden>
              {[['#e2574c', 8], ['#f2c14e', 46], ['#4a7fc1', 84]].map(([c, x], i) => (
                <g key={i} stroke={c} strokeWidth="2" fill="none" strokeLinecap="round">
                  <circle cx={x + 12} cy="13" r="8" />
                  <circle cx={x + 9} cy="12" r="1" fill={c} />
                  <circle cx={x + 15} cy="12" r="1" fill={c} />
                  <path d={`M${x + 9} 16 q3 3 6 0`} />
                  {[0, 1, 2, 3, 4].map((k) => (
                    <line key={k} x1={x + 12 + 8 * Math.cos((k * 36 + 200) * Math.PI / 180)} y1={13 + 8 * Math.sin((k * 36 + 200) * Math.PI / 180)}
                      x2={x + 12 + 12 * Math.cos((k * 36 + 200) * Math.PI / 180)} y2={13 + 12 * Math.sin((k * 36 + 200) * Math.PI / 180)} />
                  ))}
                  <line x1={x + 12} y1="21" x2={x + 12} y2="34" />
                  <line x1={x + 4} y1="26" x2={x + 20} y2="26" />
                  <line x1={x + 12} y1="34" x2={x + 6} y2="42" />
                  <line x1={x + 12} y1="34" x2={x + 18} y2="42" />
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    );
  }
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
