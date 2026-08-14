'use client';

import { useState, useMemo } from 'react';

// 업로드 이미지를 화면/PDF에 알맞게 축소해 dataURL로 변환 (용량·속도 안정화)
function fileToResizedDataURL(file, maxW = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 문서 블록 한 개를 화면/인쇄용으로 렌더
function Block({ b }) {
  if (b.type === 'title') return <h1 className="doc-title">{b.text}</h1>;
  if (b.type === 'heading') return <h2 className="doc-heading">{b.text}</h2>;
  if (b.type === 'subheading') return <h3 className="doc-subheading">{b.text}</h3>;
  if (b.type === 'para') return <p className="doc-para">{b.text || ' '}</p>;
  if (b.type === 'note') return <p className="doc-note">{b.text}</p>;
  if (b.type === 'image') {
    if (!b.src) return <p className="doc-img-empty">{b.emptyText || '이미지가 첨부되지 않았습니다.'}</p>;
    return (
      <figure className="doc-figure">
        <img src={b.src} alt={b.caption || ''} />
        {b.caption && <figcaption>{b.caption}</figcaption>}
      </figure>
    );
  }
  if (b.type === 'images') {
    const items = (b.items || []).filter(Boolean);
    if (!items.length) return null;
    return (
      <div className="doc-photos-wrap">
        <div className="doc-photos">
          {items.map((src, i) => (
            <figure key={i} className="doc-photo"><img src={src} alt="" /></figure>
          ))}
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
            <tr key={i}>
              <th>{label}</th>
              <td>{value || ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (b.type === 'sign') {
    return (
      <div className="doc-sign">
        <div className="doc-sign-date">{b.text}</div>
        <div className="doc-sign-name">
          {b.role} {b.name} <span className="doc-sign-seal">(인)</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function DocForm({ doc, onBack }) {
  const initial = useMemo(() => {
    const o = {};
    doc.fields.forEach((f) => { o[f.key] = ''; });
    return o;
  }, [doc]);

  const [values, setValues] = useState(initial);
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const set = (k, v) => { setValues((p) => ({ ...p, [k]: v })); setShowPreview(false); };

  async function onPickImage(k, fileList, multiple) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map((f) => fileToResizedDataURL(f)));
      if (multiple) {
        setValues((p) => ({ ...p, [k]: [...(Array.isArray(p[k]) ? p[k] : []), ...urls] }));
      } else {
        setValues((p) => ({ ...p, [k]: urls[0] }));
      }
      setShowPreview(false);
    } catch {
      setAiError('이미지를 불러오지 못했습니다. 다른 사진으로 시도해 주세요.');
    }
  }
  function removeImage(k, idx) {
    setValues((p) => {
      if (idx == null) return { ...p, [k]: '' };
      const arr = Array.isArray(p[k]) ? p[k].slice() : [];
      arr.splice(idx, 1);
      return { ...p, [k]: arr };
    });
    setShowPreview(false);
  }

  const requiredMissing = doc.fields.some((f) => f.required && typeof values[f.key] === 'string' && !values[f.key]?.trim() && f.type !== 'image' && f.type !== 'images');

  async function runAi() {
    setAiError('');
    setAiLoading(true);
    try {
      // 이미지(사진)는 AI 분석에 불필요하고 용량이 커서 제외하고 글자만 보냄
      const textValues = {};
      doc.fields.forEach((f) => {
        if (f.type !== 'image' && f.type !== 'images') textValues[f.key] = values[f.key];
      });
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: doc.id, values: textValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 작성에 실패했습니다');
      setAi(data.result);
      setShowPreview(true);
      setTimeout(() => document.getElementById('preview-anchor')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function makePreview() {
    setShowPreview(true);
    setTimeout(() => document.getElementById('preview-anchor')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  const blocks = showPreview ? doc.build(values, ai) : [];

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 문서 목록으로</button>

      <div className="doc-head">
        <h2 className="doc-name">{doc.name}</h2>
        <p className="doc-meta"><span className="chip">{doc.item}</span> <span className="chip freq">필요 횟수 · {doc.freq}</span></p>
        <p className="doc-desc">{doc.desc}</p>
      </div>

      <div className="card">
        <h3 className="card-title">1. 빈칸 채우기</h3>
        {doc.fields.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}{f.required && <span className="req">*</span>}</label>
            {f.type === 'textarea' ? (
              <textarea rows={4} value={values[f.key]} placeholder={f.placeholder || ''} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'select' ? (
              <select value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">선택하세요</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'image' ? (
              <div className="img-field">
                {values[f.key] ? (
                  <div className="img-thumb">
                    <img src={values[f.key]} alt="" />
                    <button type="button" className="img-del" onClick={() => removeImage(f.key, null)}>✕ 삭제</button>
                  </div>
                ) : (
                  <label className="img-upload">
                    📷 사진 선택
                    <input type="file" accept="image/*" hidden onChange={(e) => onPickImage(f.key, e.target.files, false)} />
                  </label>
                )}
              </div>
            ) : f.type === 'images' ? (
              <div className="img-field">
                <div className="img-grid">
                  {(Array.isArray(values[f.key]) ? values[f.key] : []).map((src, idx) => (
                    <div className="img-thumb sm" key={idx}>
                      <img src={src} alt="" />
                      <button type="button" className="img-del" onClick={() => removeImage(f.key, idx)}>✕</button>
                    </div>
                  ))}
                  <label className="img-upload sm">
                    ＋ 사진 추가
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => onPickImage(f.key, e.target.files, true)} />
                  </label>
                </div>
              </div>
            ) : (
              <input type={f.type === 'date' ? 'date' : 'text'} value={values[f.key]} placeholder={f.placeholder || ''} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card-title">2. 문서 만들기</h3>
        {doc.ai ? (
          <>
            <p className="hint">아래 버튼을 누르면 AI가 빈칸 내용을 바탕으로 문장을 완성합니다. 결과는 미리보기에서 확인·저장하세요.</p>
            <button className="primary" onClick={runAi} disabled={aiLoading || requiredMissing}>
              {aiLoading ? 'AI가 작성 중입니다…' : `✍️ ${doc.ai.button}`}
            </button>
            <button className="ghost" onClick={makePreview} disabled={requiredMissing} style={{ marginLeft: 8 }}>
              AI 없이 미리보기
            </button>
            {aiError && <p className="error">⚠️ {aiError}</p>}
          </>
        ) : (
          <>
            <p className="hint">이 문서는 AI 없이 바로 완성됩니다.</p>
            <button className="primary" onClick={makePreview} disabled={requiredMissing}>📄 미리보기 만들기</button>
          </>
        )}
        {requiredMissing && <p className="hint" style={{ color: '#c0392b' }}>필수 항목(*)을 먼저 입력해 주세요.</p>}
      </div>

      {showPreview && (
        <>
          <div id="preview-anchor" />
          <div className="card">
            <h3 className="card-title">3. 미리보기 · 저장</h3>
            <p className="hint">아래가 완성된 문서입니다. [PDF로 저장]을 누른 뒤 인쇄 대화상자에서 <b>대상을 "PDF로 저장"</b>으로 선택하세요.</p>
            <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (또는 인쇄)</button>
          </div>

          <div className="page-outer">
            <div className="print-area">
              <div className="doc-page">
                {blocks.map((b, i) => <Block key={i} b={b} />)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
