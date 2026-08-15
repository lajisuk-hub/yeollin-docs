'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import PrintSheet from './PrintSheet';

// '서류 새로 만들기' 전용 작성 화면 (기존 분석·정리 화면과 별개)
// 기본사항(어린이집·교직원·반·원아)을 재료로 서류 묶음을 한 번에 만든다.
function Block({ b }) {
  if (b.type === 'title') return <h1 className="doc-title">{b.text}</h1>;
  if (b.type === 'lead') return <p className="doc-lead">{b.text}</p>;
  if (b.type === 'heading') return <h2 className="doc-heading">{b.text}</h2>;
  if (b.type === 'sessionhead') return <h3 className="doc-sessionhead">{b.text}</h3>;
  if (b.type === 'para') return <p className="doc-para">{b.text || ' '}</p>;
  if (b.type === 'note') return <p className="doc-note">{b.text}</p>;
  if (b.type === 'pagebreak') return <div className="doc-pagebreak" />;
  if (b.type === 'blank') {
    return (
      <div className="doc-blank">
        {Array.from({ length: b.lines || 3 }).map((_, i) => <span key={i} />)}
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
          {b.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c || ' '}</td>)}</tr>
          ))}
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

export default function NewDocForm({ doc, onBack }) {
  const initial = useMemo(() => {
    const o = { ...(doc.defaults || {}) };
    doc.fields.forEach((f) => {
      if (!f.key) return;
      if (o[f.key] === undefined) o[f.key] = f.type === 'check' ? false : '';
    });
    return o;
  }, [doc]);

  const [values, setValues] = useState(initial);
  const [basic, setBasic] = useState(null);
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadedRef = useRef(false);
  const saveTimer = useRef(null);
  const key = `new-${doc.id}`;

  // ── 기본사항 불러오기 + 자동 저장/복원 ──
  useEffect(() => {
    loadedRef.current = false;
    let alive = true;
    Promise.all([loadForm(key), loadForm('basic-info')]).then(([savedData, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (savedData?.values) {
        setValues({ ...initial, ...savedData.values });
        if (savedData.ai) setAi(savedData.ai);
        setRestored(true);
      }
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, [key, initial]);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveForm(key, { values, ai }).then((ok) => { if (ok) setSaved(true); });
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [values, ai, key]);

  const set = (k, v) => { setValues((p) => ({ ...p, [k]: v })); setShowPreview(false); };

  function resetForm() {
    if (!window.confirm('이 서류에 입력한 내용을 지우고 새로 시작할까요? (기본사항은 그대로 있습니다)')) return;
    clearForm(key);
    setValues(initial);
    setAi(null);
    setShowPreview(false);
    setRestored(false);
  }

  const requiredMissing = doc.fields.some((f) => f.required && f.key && !String(values[f.key] || '').trim());
  const nothingPicked = doc.fields.filter((f) => f.type === 'check').every((f) => !values[f.key]);

  async function runAi() {
    setAiError('');
    setAiLoading(true);
    try {
      const res = await fetch('/api/newdraft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: doc.id, values, basic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 작성에 실패했습니다');
      setAi(data.result);
      setShowPreview(true);
      setTimeout(() => document.getElementById('new-preview')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function makePreview() {
    setShowPreview(true);
    setTimeout(() => document.getElementById('new-preview')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  const blocks = showPreview ? doc.build(values, ai, basic || {}) : [];
  const pageCount = blocks.filter((b) => b.type === 'pagebreak').length + (blocks.length ? 1 : 0);

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 새로 만들 서류 목록으로</button>

      <div className="doc-head">
        <h2 className="doc-name">{doc.name} <span className="newdoc-badge">새로 만들기</span></h2>
        <p className="doc-meta"><span className="chip">{doc.area}</span> <span className="chip freq">필요 횟수 · {doc.freq}</span></p>
        <p className="doc-desc">{doc.desc}</p>
      </div>

      {basic && !basic.centerName && (
        <p className="error">⚠️ 기본사항(어린이집 이름·반·원아)이 비어 있습니다. 먼저 등록하시면 명단이 자동으로 채워집니다.</p>
      )}

      <div className="save-bar">
        <span className="save-note">
          💾 이 브라우저에 <b>자동 저장</b>돼요. 새로고침해도 <b>작성 내용이 남습니다.</b>
          {saved && <span className="save-ok"> ✓ 저장됨</span>}
        </span>
        <button type="button" className="reset-btn" onClick={resetForm}>🗑 새로 작성(초기화)</button>
      </div>
      {restored && <p className="restored-msg">↩︎ 이전에 작성하던 내용을 불러왔어요.</p>}

      <div className="card">
        <h3 className="card-title">1. 상담 계획 정하기</h3>
        <p className="hint">날짜와 방법만 정하면 나머지(명단·표·문장)는 기본사항과 AI가 채웁니다.</p>
        {doc.fields.map((f, i) => {
          if (f.type === 'section') return <div className="form-section" key={'s' + i}>{f.label}</div>;
          if (f.type === 'check') {
            return (
              <label key={f.key} className={`form-check ${values[f.key] ? 'on' : ''}`}>
                <input type="checkbox" checked={!!values[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                <span>{f.label}</span>
              </label>
            );
          }
          return (
            <div className="field" key={f.key}>
              <label>{f.label}{f.required && <span className="req">*</span>}</label>
              {f.type === 'textarea' ? (
                <textarea rows={3} value={values[f.key]} placeholder={f.placeholder || ''} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === 'select' ? (
                <select value={values[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">선택하세요</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type === 'date' ? 'date' : 'text'} value={values[f.key]} placeholder={f.placeholder || ''} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3 className="card-title">2. 서류 만들기</h3>
        <p className="hint">AI가 안내문·목적·운영결과 <b>문장</b>을 쓰고, 반별 명단과 표는 기본사항에서 <b>자동으로</b> 채워집니다.</p>
        <button className="primary" onClick={runAi} disabled={aiLoading || requiredMissing || nothingPicked}>
          {aiLoading ? 'AI가 작성 중입니다…' : `✍️ ${doc.ai.button}`}
        </button>
        <button className="ghost" onClick={makePreview} disabled={requiredMissing || nothingPicked} style={{ marginLeft: 8 }}>
          AI 없이 미리보기
        </button>
        {requiredMissing && <p className="hint" style={{ color: '#c0392b' }}>필수 항목(*)을 먼저 입력해 주세요.</p>}
        {nothingPicked && <p className="hint" style={{ color: '#c0392b' }}>만들 서류를 하나 이상 골라주세요.</p>}
        {aiError && <p className="error">⚠️ {aiError}</p>}
      </div>

      {showPreview && (
        <>
          <div id="new-preview" />
          <div className="card">
            <h3 className="card-title">3. 미리보기 · 저장</h3>
            <p className="hint">
              모두 <b>{pageCount}장</b>입니다. [PDF로 저장]을 누른 뒤 인쇄 대화상자에서 <b>대상을 PDF로 저장</b>으로 선택하세요.
              <br />※ AI가 쓴 문장은 <b>초안</b>입니다. 우리 원 상황에 맞는지 꼭 확인하고 고쳐서 쓰세요.
            </p>
            <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (또는 인쇄)</button>
          </div>

          <div className="page-outer">
            <div className="print-area">
              <PrintSheet>
                {blocks.map((b, i) => <Block key={i} b={b} />)}
              </PrintSheet>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
