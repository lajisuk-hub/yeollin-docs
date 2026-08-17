'use client';

// 다양성(연계·협력) "기존 서류 정리" (②번 길)
// 1. 우리 원에 연간계획이 있는지 → 있으면 올리기 / 없으면 활동을 적어 간이 연간 만들기
// 2. 회차마다 날짜·행사이름·연계기관·인정항목·참여인원·참여명단·사진 + 결과보고서 업로드 → AI 분석
// 3. 연간 확인 + 충족 현황 + 전체 내용 평가
// 4. 전체 문서 (1.필요성 2.연간 3.회차별 실행내역 4.전체내용평가)

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm, setDocState } from '../lib/store';
import { readAnyFile } from '../lib/extract';
import { filesToImages } from '../lib/image';
import {
  TYPES, PARTNERS, typeName, dateText, whenText,
  emptyTidyData, emptyAct, listOf, actAt, attendText, totalCount,
  actHasContent, actRecorded, localNeedsParents, typeCounts, allTypesMet, tidyHasContent,
  planRowsOf, buildLinkTidyDoc, docTextOf, toHwpxBlocks,
} from '../lib/linkTidyDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'link-tidy';
const DOC_ID = 'link-tidy';
const MAX_PHOTOS = 4;

const STEPS = ['ask', 'acts', 'plan', 'save'];
const STEP_TITLE = {
  ask: '1. 다양성 연간계획이 있으신가요?',
  acts: '2. 활동별로 내용과 결과보고서 넣기',
  plan: '3. 연간계획 확인하고 전체 평가하기',
  save: '4. 전체 문서로 정리하기',
};

export default function LinkTidy({ onBack, onNextArea }) {
  const [data, setData] = useState(emptyTidyData());
  const [basic, setBasic] = useState(null);
  const [step, setStep] = useState('ask');
  const [cur, setCur] = useState(0);        // 지금 펼친 회차
  const [busy, setBusy] = useState('');
  const [busyMsg, setBusyMsg] = useState('');
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [done, setDone] = useState(false);
  const loadedRef = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info')]).then(([saved, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (saved) {
        setData({ ...emptyTidyData(), ...saved, acts: (saved.acts || []).length ? saved.acts : emptyTidyData().acts });
        if (saved.step) setStep(saved.step);
        if (saved.done) setDone(true);
      }
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveForm(KEY, { ...data, step, done });
      setDocState(DOC_ID, done ? 'done' : (tidyHasContent(data) ? 'writing' : null));
    }, 600);
    return () => clearTimeout(timer.current);
  }, [data, step, done]);

  const center = basic?.centerName?.trim() || '';
  const year = data.year || '2026';
  const idx = STEPS.indexOf(step);
  const a = actAt(data, cur);
  const counts = typeCounts(data);

  const upd = (patch) => setData((d) => ({ ...d, ...patch }));
  const updAct = (i, patch) => setData((d) => ({
    ...d, acts: (d.acts || []).map((x, n) => (n === i ? { ...emptyAct(), ...x, ...patch } : x)),
  }));
  const go = (s) => { setErr(''); setSaveMsg(''); setStep(s); window.scrollTo(0, 0); };
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const prev = () => go(STEPS[Math.max(idx - 1, 0)]);

  function setCenter(name) {
    setBasic((b) => {
      const nx = { ...(b || {}), centerName: name };
      saveForm('basic-info', nx);
      return nx;
    });
  }

  function restart() {
    if (!window.confirm('올린 자료와 정리한 내용을 모두 지우고 처음부터 다시 할까요?\n\n지우면 되돌릴 수 없습니다.')) return;
    clearForm(KEY);
    setDocState(DOC_ID, null);
    setData(emptyTidyData());
    setDone(false);
    go('ask');
  }

  // ── 연간계획 올리기 ──
  async function pickPlan(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy('planfile'); setBusyMsg('파일을 읽는 중입니다…');
    try {
      let added = ''; const names = [];
      for (const f of files) {
        const r = await readAnyFile(f, (m) => setBusyMsg(m));
        added += `${added ? '\n\n' : ''}${r.text}`;
        names.push(...r.names);
      }
      setData((d) => ({
        ...d,
        planSrc: d.planSrc ? `${d.planSrc}\n\n${added}` : added,
        planFiles: [...listOf(d.planFiles), ...names],
      }));
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally { setBusy(''); setBusyMsg(''); }
  }

  // ── 회차별 결과보고서 올리기 ──
  async function pickRecord(i, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy(`rec${i}`); setBusyMsg('파일을 읽는 중입니다…');
    try {
      let added = ''; const names = [];
      for (const f of files) {
        const r = await readAnyFile(f, (m) => setBusyMsg(m));
        added += `${added ? '\n\n' : ''}${r.text}`;
        names.push(...r.names);
      }
      const x = actAt(data, i);
      updAct(i, { src: x.src ? `${x.src}\n\n${added}` : added, files: [...listOf(x.files), ...names] });
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally { setBusy(''); setBusyMsg(''); }
  }

  async function addPhotos(i, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy(`ph${i}`);
    try {
      const x = actAt(data, i);
      const room = MAX_PHOTOS - (x.photos?.length || 0);
      const urls = await filesToImages(files.slice(0, room));
      updAct(i, { photos: [...(x.photos || []), ...urls] });
    } catch {
      setErr('사진을 불러오지 못했습니다.');
    } finally { setBusy(''); }
  }

  // ── AI ──
  async function ask(kind, extra = {}) {
    setBusy(kind); setErr('');
    try {
      const res = await fetch('/api/link-tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, center, year, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      return j;
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
      return null;
    } finally { setBusy(''); }
  }

  async function analyzePlan() {
    const j = await ask('plan', { planSrc: data.planSrc });
    const r = j?.result;
    if (!r) return;
    const rows = (Array.isArray(r.rows) ? r.rows : []).map((x) => ({
      when: String(x.when || ''), title: String(x.title || ''), partner: String(x.partner || ''),
      types: Array.isArray(x.types) ? x.types.filter((t) => TYPES.some((y) => y.key === t)) : [],
      content: String(x.content || ''),
    }));
    setData((d) => {
      // 연간 회차 수에 맞춰 활동 칸을 만들고, 비어 있는 칸은 연간 내용으로 미리 채운다
      const acts = rows.map((p, i) => {
        const old = (d.acts || [])[i] || emptyAct();
        return {
          ...old,
          title: old.title || p.title,
          partner: old.partner || p.partner,
          types: (old.types || []).length ? old.types : p.types,
        };
      });
      return {
        ...d,
        year: /^\d{4}$/.test(String(r.year || '')) ? String(r.year) : d.year,
        planRows: rows.length ? rows : d.planRows,
        planMissing: Array.isArray(r.missing) ? r.missing : [],
        planAnalyzed: true,
        acts: acts.length ? acts : d.acts,
      };
    });
  }

  async function analyzeRecord(i, again = false) {
    const x = actAt(data, i);
    const j = await ask('record', {
      recordSrc: x.src,
      actInfo: [x.title && `활동명 ${x.title}`, x.date && `날짜 ${x.date}`, x.partner && `연계 대상 ${x.partner}`].filter(Boolean).join(' / '),
      ...(again && x.feedback?.trim() ? { previous: JSON.stringify({ summary: x.summary, review: x.review }), feedback: x.feedback } : {}),
    });
    const r = j?.result;
    if (!r) return;
    updAct(i, {
      title: r.title || x.title,
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : x.date,
      time: r.time || x.time,
      place: r.place || x.place,
      partner: r.partner || x.partner,
      types: (x.types || []).length ? x.types : (Array.isArray(r.types) ? r.types.filter((t) => TYPES.some((y) => y.key === t)) : []),
      parents: r.parents || x.parents,
      kids: r.kids || x.kids,
      staff: r.staff || x.staff,
      names: r.names || x.names,
      summary: r.summary || '',
      review: r.review || '',
      missing: Array.isArray(r.missing) ? r.missing : [],
      analyzed: true,
      feedback: '',
    });
  }

  const actsText = () => (data.acts || []).filter(actHasContent)
    .map((x, i) => `${i + 1}회 ${x.title || ''} (${x.date ? dateText(x.date) : '일시 미입력'}) — ${x.partner || ''} / ${(x.types || []).map(typeName).join('·')}\n${x.summary || ''}`)
    .join('\n\n');
  const countsText = () => TYPES.map((t) => `${t.name} ${counts[t.key]}회 (필요 ${t.need}회)`).join(' / ');

  async function makeNeed() {
    const j = await ask('need', {
      actsText: actsText(),
      ...(data.need && data.needFeedback?.trim() ? { previous: data.need, feedback: data.needFeedback } : {}),
    });
    if (j?.text) upd({ need: j.text, needFeedback: '' });
  }

  async function makeOverall() {
    const j = await ask('overall', {
      actsText: actsText(), counts: countsText(),
      ...(data.overall && data.overallFeedback?.trim() ? { previous: data.overall, feedback: data.overallFeedback } : {}),
    });
    if (j?.text) upd({ overall: j.text, overallFeedback: '' });
  }

  async function reviseDoc() {
    const j = await ask('revise', { docText: docTextOf(data), request: data.reviseFeedback });
    const r = j?.result;
    if (!r) return;
    setData((d) => {
      const acts = (d.acts || []).map((x, i) => {
        const hit = (Array.isArray(r.acts) ? r.acts : []).find((y) => Number(y?.i) === i);
        if (!hit) return x;
        const patch = {};
        if (String(hit.summary || '').trim()) patch.summary = hit.summary;
        if (String(hit.review || '').trim()) patch.review = hit.review;
        return { ...x, ...patch };
      });
      const log = [
        ...(Array.isArray(r.changed) ? r.changed : []),
        ...(String(r.note || '').trim() ? [`※ ${r.note}`] : []),
      ];
      return {
        ...d,
        need: String(r.need || '').trim() ? r.need : d.need,
        overall: String(r.overall || '').trim() ? r.overall : d.overall,
        acts,
        reviseFeedback: '',
        reviseLog: log.length ? log : ['고칠 내용을 찾지 못했습니다. 조금 더 자세히 적어 주세요.'],
      };
    });
  }

  const blocks = buildLinkTidyDoc(data, basic || {});

  async function saveHwpx() {
    setBusy('hwpx'); setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_${year}_연계협력활동.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. (사진은 PDF로 저장해 주세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(''); }
  }

  // 항목별 충족 현황 칩
  const TypeStat = () => (
    <div className="tstat-row">
      {TYPES.map((t) => {
        const n = counts[t.key];
        const ok = n >= t.need;
        return (
          <span key={t.key} className={`tstat ${ok ? 'ok' : ''}`}>
            {ok ? '✅' : '⚠️'} {t.name} <b>{n}</b> / {t.need}회 <em>{t.pt}점</em>
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 문서 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-bar"><span style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="wiz-count">{idx + 1} / {STEPS.length} 단계 · 연계·협력(다양성) 서류 정리</div>
        <h1>{STEP_TITLE[step]}</h1>
      </div>

      {err && <p className="error">⚠️ {err}</p>}

      {/* ───────── 1. 연간계획 있는지 물어보기 ───────── */}
      {step === 'ask' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            다양성 영역은 <b>연간계획이 반드시 있어야</b> 합니다. 우리 원에 연계·협력 <b>연간계획</b>이 있으신가요?
          </p>

          <div className="tidy-note">
            📌 <b>최소 충족 횟수</b>를 먼저 확인하세요.
            <ul className="kw-list">
              {TYPES.map((t) => (
                <li key={t.key}>
                  <b>{t.name}</b> ({t.pt}점) — <b>연 {t.need}회 이상</b>. {t.hint}
                </li>
              ))}
            </ul>
            ⚠️ 두 항목은 <b>같은 활동으로 둘 다 인정</b>받을 수 있습니다. (예: 이웃 어린이집과 도서관에 함께 간 활동에 부모가 참여하면 두 항목 모두 인정)<br />
            ⚠️ <b>지역사회 연계는 부모가 함께 참여</b>해야 인정됩니다. 영유아만 간 활동은 인정되지 않습니다.
          </div>

          <div className="wiz-2col">
            <div className="field">
              <label>어린이집 이름 <span className="req">*</span></label>
              <input type="text" value={center} placeholder="예) 멘토어린이집" onChange={(e) => setCenter(e.target.value)} />
            </div>
            <div className="field">
              <label>연도</label>
              <select value={year} onChange={(e) => upd({ year: e.target.value })}>
                {['2025', '2026'].map((y) => <option key={y} value={y}>{y}년도</option>)}
              </select>
            </div>
          </div>

          <div className="ask-grid">
            <button className={`ask-card ${data.hasPlan === true ? 'on' : ''}`} onClick={() => upd({ hasPlan: true })}>
              <b>연간계획이 있습니다</b>
              <span>가지고 있는 연간계획을 올리면 AI가 읽어서 회차 표로 정리합니다.</span>
            </button>
            <button className={`ask-card ${data.hasPlan === false ? 'on' : ''}`} onClick={() => upd({ hasPlan: false })}>
              <b>연간계획이 없습니다</b>
              <span>실시한 활동을 적어 주시면 그것으로 <b>간이 연간계획</b>을 만들어 드립니다.</span>
            </button>
          </div>

          {data.hasPlan === true && (
            <div className="tidy-sec">
              <h4>연간계획 올리기</h4>
              <p className="hint">한글(hwpx) · 워드(docx) · PDF · 텍스트 · 압축(zip) 파일을 올릴 수 있습니다.</p>
              <div className="tidy-src">
                <label className="file-btn">
                  {busy === 'planfile' ? (busyMsg || '읽는 중…') : (listOf(data.planFiles).length ? '📎 파일 더 올리기' : '📎 연간계획 올리기')}
                  <input type="file" accept=".hwpx,.docx,.pdf,.txt,.zip" multiple hidden disabled={!!busy}
                    onChange={(e) => { pickPlan(e.target.files); e.target.value = ''; }} />
                </label>
                {listOf(data.planFiles).length > 0 && (
                  <>
                    <span className="tidy-file">✔ {listOf(data.planFiles).join(' · ')}</span>
                    <button type="button" className="ghost sm" style={{ marginLeft: 8 }}
                      onClick={() => upd({ planSrc: '', planFiles: [], planRows: [], planAnalyzed: false })}>비우기</button>
                  </>
                )}
                {data.planSrc && (
                  <details className="tidy-peek">
                    <summary>올린 내용 보기 · 고치기 ({data.planSrc.length.toLocaleString()}자)</summary>
                    <textarea rows={8} value={data.planSrc} onChange={(e) => upd({ planSrc: e.target.value })} />
                  </details>
                )}
              </div>
              <button className="primary" onClick={analyzePlan} disabled={!!busy || !data.planSrc?.trim()}>
                {busy === 'plan' ? 'AI가 계획서를 읽는 중입니다…' : `🤖 ${data.planAnalyzed ? '다시 ' : ''}연간계획 읽어서 표로 정리하기`}
              </button>
              {(data.planMissing || []).length > 0 && (
                <div className="tidy-missing">
                  <h4>⚠️ 계획서에서 찾지 못한 것</h4>
                  <ul>{data.planMissing.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}
              {(data.planRows || []).length > 0 && (
                <p className="hint" style={{ color: '#2E7D68' }}>
                  ✔ 연간계획에서 <b>{data.planRows.length}회차</b>를 읽었습니다. 다음 단계에서 회차마다 결과보고서를 올려 주세요.
                </p>
              )}
            </div>
          )}

          {data.hasPlan === false && (
            <div className="tidy-note" style={{ marginTop: 14 }}>
              ✍️ 연간계획이 없으셔도 괜찮습니다. 다음 단계에서 <b>실시한 활동을 적어 주시면</b>
              그 내용으로 <b>간이 연간계획 표</b>를 자동으로 만들어 문서에 넣어 드립니다.
            </div>
          )}

          <div className="wiz-nav">
            <button className="ghost" onClick={onBack}>← 문서 목록</button>
            <button className="primary" onClick={next} disabled={data.hasPlan === null}>다음 · 활동 넣기 →</button>
          </div>
          {data.hasPlan === null && <p className="hint">위에서 하나를 고르면 다음으로 넘어갈 수 있습니다.</p>}
        </div>
      )}

      {/* ───────── 2. 회차별 활동 ───────── */}
      {step === 'acts' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              회차를 골라 <b>날짜 · 행사이름 · 참여인원 · 참여명단 · 사진</b>을 넣고,
              <b> 결과보고서</b>를 올리면 AI가 진행내용과 평가로 정리합니다.
            </p>
            <TypeStat />
            {!allTypesMet(data) && (
              <p className="hint" style={{ color: '#b3620a' }}>
                ⚠️ 아직 최소 횟수를 채우지 못했습니다. 날짜·행사이름·결과보고서가 모두 있어야 <b>1회로 셉니다.</b>
              </p>
            )}

            <div className="q-grid">
              {(data.acts || []).map((x, i) => (
                <button key={i} className={`q-card ${actRecorded(x) ? 'done' : ''} ${cur === i ? 'cur' : ''}`} onClick={() => { setCur(i); window.scrollTo(0, 300); }}>
                  <div className="q-top">
                    <b>{i + 1}회</b>
                    <span className={`q-chip ${actRecorded(x) ? 'ok' : ''}`}>{actRecorded(x) ? '완성' : actHasContent(x) ? '작성 중' : '아직'}</span>
                  </div>
                  <div className="q-when">{x.title || '행사이름 미입력'}</div>
                  {x.date && <div className="q-date">{dateText(x.date)}</div>}
                </button>
              ))}
            </div>
            <div className="mem-tools">
              <button type="button" className="ghost sm" onClick={() => upd({ acts: [...(data.acts || []), emptyAct()] })}>＋ 회차 추가</button>
              {(data.acts || []).length > 1 && (
                <button type="button" className="ghost sm" onClick={() => { upd({ acts: data.acts.slice(0, -1) }); setCur(0); }}>마지막 회차 지우기</button>
              )}
            </div>
          </div>

          <div className="card wiz-card">
            <h3 className="wiz-sub">{cur + 1}회차 내용 <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span></h3>

            <div className="wiz-2col">
              <div className="field">
                <label>날짜 (달력에서 고르세요)</label>
                <input type="date" value={a.date} onChange={(e) => updAct(cur, { date: e.target.value })} />
              </div>
              <div className="field">
                <label>시각 (선택)</label>
                <input type="text" value={a.time} placeholder="예) 오전 10시 ~ 11시 30분" onChange={(e) => updAct(cur, { time: e.target.value })} />
              </div>
            </div>
            <div className="wiz-2col">
              <div className="field">
                <label>행사이름</label>
                <input type="text" value={a.title} placeholder="예) 이웃 어린이집과 함께하는 봄 운동회" onChange={(e) => updAct(cur, { title: e.target.value })} />
              </div>
              <div className="field">
                <label>지역사회 · 인근기관 (연계 대상)</label>
                <input type="text" value={a.partner} placeholder="예) 햇살어린이집 / 구립도서관" onChange={(e) => updAct(cur, { partner: e.target.value })} list="partner-list" />
                <datalist id="partner-list">{PARTNERS.map((p) => <option key={p} value={p} />)}</datalist>
              </div>
            </div>
            <div className="field">
              <label>장소 (선택)</label>
              <input type="text" value={a.place} placeholder="예) 어린이집 앞 근린공원" onChange={(e) => updAct(cur, { place: e.target.value })} />
            </div>

            <div className="field">
              <label>어느 항목으로 인정받을까요? (둘 다 고를 수 있습니다)</label>
              <div className="chk-list">
                {TYPES.map((t) => {
                  const on = (a.types || []).includes(t.key);
                  return (
                    <label key={t.key} className={`chk ${on ? 'on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => {
                        const curT = a.types || [];
                        updAct(cur, { types: on ? curT.filter((k) => k !== t.key) : [...curT, t.key] });
                      }} />
                      <span>{t.name} <em>{t.pt}점</em></span>
                    </label>
                  );
                })}
              </div>
              {localNeedsParents(a) && (
                <p className="hint" style={{ color: '#b3620a' }}>
                  ⚠️ <b>지역사회 연계</b>는 부모가 함께 참여해야 인정됩니다. 아래 <b>부모 인원</b>을 넣어 주세요.
                </p>
              )}
            </div>

            <div className="field">
              <label>참여인원</label>
              <div className="wiz-3col">
                <input type="text" inputMode="numeric" value={a.parents} placeholder="부모 ○명" onChange={(e) => updAct(cur, { parents: e.target.value })} />
                <input type="text" inputMode="numeric" value={a.kids} placeholder="영유아 ○명" onChange={(e) => updAct(cur, { kids: e.target.value })} />
                <input type="text" inputMode="numeric" value={a.staff} placeholder="교직원 ○명" onChange={(e) => updAct(cur, { staff: e.target.value })} />
              </div>
              <p className="hint">{attendText(a) ? `→ 문서에는 ${attendText(a)} (총 ${totalCount(a)}명) 로 들어갑니다.` : '→ 숫자를 넣으면 문서 표에 들어갑니다.'}</p>
            </div>

            <div className="field">
              <label>참여명단</label>
              <textarea rows={3} value={a.names} placeholder="예) 김○○(모), 이○○(부), 박○○(모) …  또는 햇님반 12명, 달님반 10명"
                onChange={(e) => updAct(cur, { names: e.target.value })} />
            </div>

            <div className="tidy-sec">
              <h4>사진</h4>
              <div className="img-grid">
                {(a.photos || []).map((src, i) => (
                  <div className="img-thumb sm" key={i}>
                    <img src={src} alt="" />
                    <button type="button" className="img-del" onClick={() => updAct(cur, { photos: a.photos.filter((_, n) => n !== i) })}>✕</button>
                  </div>
                ))}
                {(a.photos?.length || 0) < MAX_PHOTOS && (
                  <label className={`img-upload sm ${busy === `ph${cur}` ? 'busy' : ''}`}>
                    {busy === `ph${cur}` ? '불러오는 중…' : '＋ 사진 추가'}
                    <input type="file" accept="image/*,application/pdf" multiple hidden disabled={!!busy}
                      onChange={(e) => { addPhotos(cur, e.target.files); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>

            <div className="tidy-sec">
              <h4>결과보고서 올리기</h4>
              <p className="hint">
                {data.hasPlan
                  ? '연간계획의 이 회차에 해당하는 결과보고서를 올려 주세요.'
                  : '이 활동의 결과보고서를 올려 주세요. 없으면 아래 진행내용·평가에 직접 적으셔도 됩니다.'}
              </p>
              <div className="tidy-src">
                <label className="file-btn">
                  {busy === `rec${cur}` ? (busyMsg || '읽는 중…') : (listOf(a.files).length ? '📎 파일 더 올리기' : '📎 결과보고서 올리기 (한글·워드·PDF·zip)')}
                  <input type="file" accept=".hwpx,.docx,.pdf,.txt,.zip" multiple hidden disabled={!!busy}
                    onChange={(e) => { pickRecord(cur, e.target.files); e.target.value = ''; }} />
                </label>
                {listOf(a.files).length > 0 && (
                  <>
                    <span className="tidy-file">✔ {listOf(a.files).join(' · ')}</span>
                    <button type="button" className="ghost sm" style={{ marginLeft: 8 }} onClick={() => updAct(cur, { src: '', files: [] })}>비우기</button>
                  </>
                )}
                {a.src && (
                  <details className="tidy-peek">
                    <summary>올린 내용 보기 · 고치기 ({a.src.length.toLocaleString()}자)</summary>
                    <textarea rows={8} value={a.src} onChange={(e) => updAct(cur, { src: e.target.value })} />
                  </details>
                )}
              </div>
              <button className="primary" onClick={() => analyzeRecord(cur, false)} disabled={!!busy || !a.src?.trim()}>
                {busy === 'record' ? 'AI가 분석 중입니다…' : `🤖 ${a.analyzed ? '다시 ' : ''}결과보고서 분석하기`}
              </button>

              {(a.missing || []).length > 0 && (
                <div className="tidy-missing">
                  <h4>⚠️ 자료에서 찾지 못해 비워 둔 것</h4>
                  <ul>{a.missing.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}
            </div>

            <div className="field">
              <label>연계·협력 활동 진행내용</label>
              <textarea rows={6} value={a.summary} onChange={(e) => updAct(cur, { summary: e.target.value })} />
            </div>
            <div className="field">
              <label>평가 <span className="edit-badge">🤖 올린 결과보고서를 보고 AI가 분석합니다</span></label>
              <textarea rows={6} value={a.review} onChange={(e) => updAct(cur, { review: e.target.value })} />
            </div>
            <div className="field">
              <label>고칠 부분이 있으면 적어주세요 (다시 분석합니다)</label>
              <input type="text" value={a.feedback || ''} placeholder="예) 부모님 소감을 더 자세히 넣어주세요"
                onChange={(e) => updAct(cur, { feedback: e.target.value })} />
              {a.feedback?.trim() && (
                <button className="ghost" onClick={() => analyzeRecord(cur, true)} disabled={!!busy}>↻ 고쳐서 다시 분석하기</button>
              )}
            </div>

            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              {cur < (data.acts || []).length - 1
                ? <button className="primary" onClick={() => { setCur(cur + 1); window.scrollTo(0, 300); }}>{cur + 2}회차 이어서 →</button>
                : <button className="primary" onClick={next}>다음 · 연간계획 확인하기 →</button>}
            </div>
          </div>
        </>
      )}

      {/* ───────── 3. 연간계획 확인 + 전체 평가 ───────── */}
      {step === 'plan' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            {data.hasPlan
              ? '올려 주신 연간계획입니다. 문서에 이대로 들어갑니다.'
              : '적어 주신 활동으로 만든 간이 연간계획입니다. 문서에 이대로 들어갑니다.'}
          </p>
          {!data.hasPlan && (
            <p className="hint" style={{ color: '#2E7D68' }}>
              ✔ 연간계획이 없으셔서 <b>실시한 활동으로 간이 연간계획을 만들었습니다.</b>
            </p>
          )}

          <div className="plan-head six">
            <span>구분</span><span>시기</span><span>활동명</span><span>연계 대상</span><span>인정 항목</span><span>주요 내용</span>
          </div>
          {planRowsOf(data).map((r, i) => (
            <div className="plan-row six" key={i}>
              <span className="plan-m">{r.no}</span>
              <span>{r.when || '—'}</span>
              <span>{r.title || '—'}</span>
              <span>{r.partner || '—'}</span>
              <span>{r.types || '—'}</span>
              <span>{r.content || '—'}</span>
            </div>
          ))}
          {!planRowsOf(data).length && <p className="hint">아직 내용이 없습니다. 이전 단계에서 활동을 적어 주세요.</p>}

          <div className="tidy-sec">
            <h4>항목별 충족 현황</h4>
            <TypeStat />
            {allTypesMet(data)
              ? <p className="hint" style={{ color: '#2E7D68' }}>👍 두 항목 모두 최소 횟수를 채웠습니다.</p>
              : <p className="hint" style={{ color: '#b3620a' }}>⚠️ 아직 채우지 못한 항목이 있습니다. 이전 단계에서 활동을 더 넣어 주세요.</p>}
          </div>

          <div className="tidy-sec">
            <h4>4. 전체 내용 평가</h4>
            <p className="hint">한 해 동안 실시한 연계·협력 활동 전체를 AI가 정리해 드립니다.</p>
            <button className="primary" onClick={makeOverall} disabled={!!busy}>
              {busy === 'overall' ? 'AI가 쓰는 중입니다…' : `✍️ ${data.overall ? '다시 ' : ''}전체 내용 평가 쓰기`}
            </button>
            {data.overall && (
              <>
                <div className="wiz-result-top" style={{ marginTop: 10 }}>
                  <span>전체 내용 평가</span>
                  <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span>
                </div>
                <textarea rows={9} value={data.overall} onChange={(e) => upd({ overall: e.target.value })} />
                <div className="field">
                  <label>고칠 부분이 있으면 적어주세요</label>
                  <input type="text" value={data.overallFeedback || ''} placeholder="예) 내년 계획을 더 구체적으로 써주세요"
                    onChange={(e) => upd({ overallFeedback: e.target.value })} />
                  {data.overallFeedback?.trim() && <button className="ghost" onClick={makeOverall} disabled={!!busy}>🔁 다시 쓰기</button>}
                </div>
              </>
            )}
          </div>

          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next}>다음 · 전체 문서 보기 →</button>
          </div>
        </div>
      )}

      {/* ───────── 4. 전체 문서 ───────── */}
      {step === 'save' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>1. 필요성 → 2. 연간계획 → 3. 회차별 실행내역 → 4. 전체 내용 평가</b> 순서로 묶었습니다.
            </p>

            <div className="tidy-sec">
              <h4>1. 연계·협력 활동의 필요성</h4>
              <button className="primary" onClick={makeNeed} disabled={!!busy}>
                {busy === 'need' ? 'AI가 쓰는 중입니다…' : `✍️ ${data.need ? '다시 ' : ''}필요성 쓰기`}
              </button>
              {data.need && <textarea rows={7} style={{ marginTop: 10 }} value={data.need} onChange={(e) => upd({ need: e.target.value })} />}
              <p className="hint">비워 두시면 기본 문구가 들어갑니다.</p>
            </div>

            <TypeStat />

            <div className="wiz-nav">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (사진 포함)</button>
              <button className="ghost" onClick={saveHwpx} disabled={!!busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
          </div>

          <div className="card wiz-card">
            <h3 className="wiz-sub">📝 아래 문서를 읽어 보시고, 고칠 부분을 알려주세요</h3>
            <p className="hint">
              적어 주시면 AI가 <b>필요성 · 회차별 진행내용·평가 · 전체 내용 평가</b>에서 해당하는 곳을 찾아 고쳐 씁니다.
              (날짜·인원처럼 표에 들어가는 값은 앞 단계에서 고쳐 주세요)
            </p>
            <textarea rows={4} value={data.reviseFeedback || ''}
              placeholder={'예) 2회차 평가에 부모님 참여가 많았다는 내용을 넣어주세요.\n예) 전체 평가에 내년에는 경로당과도 연계하겠다는 내용을 넣어주세요.'}
              onChange={(e) => upd({ reviseFeedback: e.target.value })} />
            <button className="primary" onClick={reviseDoc} disabled={!!busy || !data.reviseFeedback?.trim()}>
              {busy === 'revise' ? 'AI가 고치는 중입니다…' : '🤖 말씀하신 대로 고치기'}
            </button>
            {(data.reviseLog || []).length > 0 && (
              <div className="tidy-sum" style={{ marginTop: 12 }}>
                <h4>✅ 이렇게 고쳤습니다</h4>
                <ul>{data.reviseLog.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}

            <button type="button" className={`done-btn ${done ? 'on' : ''}`} style={{ marginTop: 14 }} onClick={() => setDone((v) => !v)}>
              {done ? '✅ 작성 완료로 표시했습니다 (누르면 취소)' : '✅ 이 서류 작성 완료로 표시하기'}
            </button>

            {onNextArea && (
              <button className="next-doc" onClick={onNextArea}>
                ✅ 다양성이 끝났습니다 · 다음 단계(지자체 자체기준)로 →
              </button>
            )}

            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
              <button className="ghost" onClick={onBack}>문서 목록으로</button>
            </div>
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
