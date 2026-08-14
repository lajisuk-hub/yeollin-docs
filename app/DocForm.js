'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';

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

// PDF 파일 → 페이지별 이미지(dataURL) 배열
async function pdfToImages(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const imgs = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1240 / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
    imgs.push(canvas.toDataURL('image/jpeg', 0.85));
  }
  return imgs;
}

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}
function tagsToText(xml, closeTag, textTagRe) {
  return xml.split(closeTag).map((p) => {
    const m = [...p.matchAll(textTagRe)].map((x) => decodeXml(x[1].replace(/<[^>]+>/g, '')));
    return m.join('');
  }).filter((s) => s.trim()).join('\n');
}

// 업로드한 문서 파일에서 글자만 추출 (txt / pdf / docx / hwpx)
async function extractTextFromFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.txt') || file.type === 'text/plain') return (await file.text()).trim();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let txt = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const c = await (await pdf.getPage(p)).getTextContent();
      txt += c.items.map((i) => i.str).join(' ') + '\n';
    }
    return txt.trim();
  }
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  if (name.endsWith('.hwpx')) {
    const names = Object.keys(zip.files).filter((n) => /Contents\/section\d+\.xml$/i.test(n)).sort();
    let txt = '';
    for (const n of names) txt += tagsToText(await zip.files[n].async('string'), '</hp:p>', /<hp:t>([\s\S]*?)<\/hp:t>/g) + '\n';
    return txt.trim();
  }
  if (name.endsWith('.docx')) {
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('워드 문서를 읽지 못했습니다');
    return tagsToText(await f.async('string'), '</w:p>', /<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  }
  throw new Error('지원하지 않는 파일 형식입니다 (사진·PDF·한글hwpx·워드docx·txt만 가능)');
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
  if (b.type === 'pages') {
    const items = (Array.isArray(b.items) ? b.items : []).filter(Boolean);
    if (!items.length) return <p className="doc-img-empty">{b.emptyText || '첨부된 자료가 없습니다.'}</p>;
    return (
      <div className="doc-pages">
        {b.title && <div className="doc-pages-title">{b.title}</div>}
        {items.map((src, i) => (
          <figure key={i} className="doc-figure"><img src={src} alt="" /></figure>
        ))}
      </div>
    );
  }
  if (b.type === 'attachrow') {
    return (
      <div className="doc-attachrow">
        {(b.cols || []).map((col, ci) => {
          const items = (Array.isArray(col.items) ? col.items : []).filter(Boolean);
          return (
            <div className="doc-attachcol" key={ci}>
              <div className="doc-attachcol-title">{col.title}</div>
              {items.length
                ? items.map((src, i) => <figure key={i}><img src={src} alt="" /></figure>)
                : <p className="doc-img-empty">{col.emptyText || '미첨부'}</p>}
            </div>
          );
        })}
      </div>
    );
  }
  if (b.type === 'pagebreak') return <div className="doc-pagebreak" />;
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
    doc.fields.forEach((f) => { if (f.key) o[f.key] = (f.type === 'attach' || f.type === 'images') ? [] : ''; });
    return o;
  }, [doc]);

  const [values, setValues] = useState(initial);
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState({});
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── 자동 저장/복원 (같은 브라우저) ──
  const loadedRef = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    loadedRef.current = false;
    setRestored(false);
    let alive = true;
    loadForm(doc.id).then((savedData) => {
      if (!alive) return;
      if (savedData && savedData.values) {
        setValues({ ...initial, ...savedData.values });
        if (savedData.ai) setAi(savedData.ai);
        setRestored(true);
      } else {
        setValues(initial);
        setAi(null);
      }
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, [doc.id, initial]);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveForm(doc.id, { values, ai }).then((ok) => { if (ok) { setSaved(true); } });
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [values, ai, doc.id]);

  function resetForm() {
    if (typeof window !== 'undefined' && !window.confirm('작성한 내용과 첨부한 자료를 모두 지우고 새로 시작할까요?')) return;
    clearForm(doc.id);
    setValues(initial);
    setAi(null);
    setShowPreview(false);
    setRestored(false);
    setSaved(false);
  }

  const set = (k, v) => { setValues((p) => ({ ...p, [k]: v })); setShowPreview(false); };

  // 사진/PDF 첨부 (image·pdf → 이미지 배열로 누적)
  async function onPickAttach(k, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setAiError('');
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      let urls = [];
      for (const f of files) {
        const isPdf = (f.name || '').toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
        urls = urls.concat(isPdf ? await pdfToImages(f) : [await fileToResizedDataURL(f)]);
      }
      setValues((p) => ({ ...p, [k]: [...(Array.isArray(p[k]) ? p[k] : []), ...urls] }));
      setShowPreview(false);
    } catch {
      setAiError('파일을 불러오지 못했습니다. 사진 또는 PDF로 다시 시도해 주세요.');
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  }
  // 사진만 (상담 사진)
  async function onPickPhotos(k, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      const urls = await Promise.all(files.map((f) => fileToResizedDataURL(f)));
      setValues((p) => ({ ...p, [k]: [...(Array.isArray(p[k]) ? p[k] : []), ...urls] }));
      setShowPreview(false);
    } catch {
      setAiError('사진을 불러오지 못했습니다. 다른 사진으로 시도해 주세요.');
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  }
  // 상담 자료 문서 파일 → 글자 추출해 텍스트칸에 채움
  async function onPickMaterial(k, file) {
    if (!file) return;
    setAiError('');
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      const text = await extractTextFromFile(file);
      setValues((p) => ({ ...p, [k]: (p[k] ? p[k] + '\n' : '') + text }));
      setShowPreview(false);
    } catch (e) {
      setAiError(e.message || '문서를 읽지 못했습니다.');
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
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

  const requiredMissing = doc.fields.some((f) => f.required && f.key && typeof values[f.key] === 'string' && !values[f.key]?.trim());

  async function runAi() {
    setAiError('');
    setAiLoading(true);
    try {
      // 이미지(사진)는 AI 분석에 불필요하고 용량이 커서 제외하고 글자만 보냄
      const textValues = {};
      doc.fields.forEach((f) => {
        if (f.key && f.type !== 'image' && f.type !== 'images' && f.type !== 'attach') textValues[f.key] = values[f.key];
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

      <div className="save-bar">
        <span className="save-note">
          💾 이 브라우저에 <b>자동 저장</b>돼요. 새로고침하거나 창을 닫아도 <b>작성 내용·첨부파일이 남습니다.</b>
          {saved && <span className="save-ok"> ✓ 저장됨</span>}
        </span>
        <button type="button" className="reset-btn" onClick={resetForm}>🗑 새로 작성(초기화)</button>
      </div>
      {restored && <p className="restored-msg">↩︎ 이전에 작성하던 내용을 불러왔어요. 이어서 작성하시면 됩니다.</p>}

      <div className="card">
        <h3 className="card-title">1. 빈칸 채우기</h3>
        {doc.fields.map((f, fi) => {
          if (f.type === 'section') return <div className="form-section" key={'sec' + fi}>{f.label}</div>;
          const arr = Array.isArray(values[f.key]) ? values[f.key] : [];
          return (
          <div className="field" key={f.key}>
            <label>{f.label}{f.required && <span className="req">*</span>}</label>
            {f.type === 'textarea' ? (
              <textarea rows={4} value={values[f.key]} placeholder={f.placeholder || ''} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'material' ? (
              <div>
                <textarea rows={5} value={values[f.key]} placeholder={f.placeholder || ''} onChange={(e) => set(f.key, e.target.value)} />
                <label className="file-btn">
                  {busy[f.key] ? '문서 읽는 중…' : '📎 문서 파일 불러오기 (한글·워드·PDF·txt)'}
                  <input type="file" accept=".hwpx,.docx,.pdf,.txt" hidden disabled={busy[f.key]} onChange={(e) => { onPickMaterial(f.key, e.target.files[0]); e.target.value = ''; }} />
                </label>
              </div>
            ) : f.type === 'select' ? (
              <select value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">선택하세요</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'attach' || f.type === 'images' ? (
              <div className="img-field">
                <div className="img-grid">
                  {arr.map((src, idx) => (
                    <div className="img-thumb sm" key={idx}>
                      <img src={src} alt="" />
                      <button type="button" className="img-del" onClick={() => removeImage(f.key, idx)}>✕</button>
                    </div>
                  ))}
                  <label className={`img-upload sm ${busy[f.key] ? 'busy' : ''}`}>
                    {busy[f.key] ? '불러오는 중…' : (f.type === 'attach' ? '＋ 사진·PDF 추가' : '＋ 사진 추가')}
                    <input type="file" accept={f.type === 'attach' ? 'image/*,application/pdf' : 'image/*'} multiple hidden disabled={busy[f.key]}
                      onChange={(e) => { (f.type === 'attach' ? onPickAttach : onPickPhotos)(f.key, e.target.files); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
            ) : (
              <input type={f.type === 'date' ? 'date' : 'text'} value={values[f.key]} placeholder={f.placeholder || ''} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
          );
        })}
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
