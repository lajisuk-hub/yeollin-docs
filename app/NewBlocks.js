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
