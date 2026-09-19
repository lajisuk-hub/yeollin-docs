'use client';

// 부모참여프로그램 "기존 서류 정리" (②번 길)
// 원장님이 정한 순서:
//   ① 연간 운영계획(PDF 등) 올리기 → AI가 읽어 연간계획표로 정리
//   ② 3월부터 진행한 월별(또는 분기별) 실시기록을 순서대로 올리기
//      · 사진 2장 이상 필수
//      · 평가는 올린 실시기록을 근거로 AI가 분석해 작성
//   ③ 전체 문서 만들기 → 읽어 보고 고칠 부분을 적으면 AI가 고쳐 줌

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm, setDocState } from '../lib/store';
import { extractTextFromFile } from '../lib/extract';
import { fileToResizedDataURL } from '../lib/image';
import { MONTH_SEQ, planOf } from '../lib/programDoc';
import {
  MIN_PHOTOS, MAX_PHOTOS,
  emptyTidyData, emptyTidyMonth, tidyMonthOf, themeOf,
  monthTidyHasContent, monthTidyDone, photosShort,
  chosenTidyMonths, rangeTidyMonths,
  tidyYearOptions, switchTidyYear, tidyYearsWithContent, tidyYearCount,
  buildOneMonthTidy, buildProgramTidyDoc,
  RANGES, rangeInfo, rangeTitle, monthList, monthLabel, whenText, flowList, attendText,
  toHwpxBlocks,
} from '../lib/programTidyDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'program-tidy';
const DOC_ID = 'program-tidy';

const STEPS = ['upload', 'analyze', 'check', 'done'];
const STEP_TITLE = {
  upload: '실시기록 자료 올리기',
  analyze: '올린 자료 AI 분석하기',
  check: '분석 결과 확인·수정',
  done: '이 달 정리본',
};

// 예전에 저장된 것(파일 이름이 글자 하나였던 때)도 배열로 맞춘다
const fileArr = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

export default function ProgramTidy({ onBack }) {
  const [data, setData] = useState(emptyTidyData());
  const [basic, setBasic] = useState(null);
  // view: {v:'pick'} | {v:'plan'} | {v:'step', q, s} | {v:'save'}
  const [view, setView] = useState({ v: 'pick' });
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [range, setRange] = useState('all');
  const [done, setDone] = useState(false);
  const loadedRef = useRef(false);
  const timer = useRef(null);

  // ── 불러오기 / 자동 저장 ──
  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info')]).then(([saved, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (saved) {
        setData({ ...emptyTidyData(), ...saved });
        if (saved.view) setView(saved.view);
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
      saveForm(KEY, { ...data, view, done });
      const some = !!(data.planSrc?.trim() || chosenTidyMonths(data).length);
      setDocState(DOC_ID, done ? 'done' : (some ? 'writing' : null));
    }, 600);
    return () => clearTimeout(timer.current);
  }, [data, view, done]);

  const center = basic?.centerName?.trim() || '';
  const year = data.year || '2026';
  const months = monthList(year);
  const q = view.q ?? 0;
  const mi = months[q] || months[0];
  const cur = tidyMonthOf(data, mi.key);
  const stepIdx = STEPS.indexOf(view.s);
  const curPlan = planOf(data, mi.m);

  // 어린이집 이름은 다른 서류와 함께 쓰도록 기본사항(basic-info)에 저장한다
  function setCenter(name) {
    setBasic((b) => {
      const next = { ...(b || {}), centerName: name };
      saveForm('basic-info', next);
      return next;
    });
  }

  const go = (v) => { setErr(''); setSaveMsg(''); setView(v); window.scrollTo(0, 0); };
  const goStep = (s) => go({ v: 'step', q, s });
  const next = () => goStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)]);
  const prev = () => (stepIdx <= 0 ? go({ v: 'pick' }) : goStep(STEPS[stepIdx - 1]));

  // 이 달 값 고치기
  const upd = (patch) => setData((d) => ({
    ...d,
    months: { ...d.months, [mi.key]: { ...emptyTidyMonth(), ...(d.months?.[mi.key] || {}), ...patch } },
  }));

  // 잘못 올린 달 처리 (원장님 요청 2026-09-19) — ① 문서에서만 빼기(자료는 남음) ② 아예 지우기
  const toggleSkip = (key) => setData((d) => {
    const cur = d.months?.[key];
    if (!cur) return d;
    return { ...d, months: { ...d.months, [key]: { ...cur, skip: !cur.skip } } };
  });
  const removeMonth = (x) => {
    if (!window.confirm(x.label + ' 자료를 지울까요?\n\n이 달에 올린 자료와 사진이 모두 지워지고 되돌릴 수 없습니다.\n(문서에서만 빼려면 「빼기」를 누르세요.)')) return;
    setData((d) => {
      const next = { ...(d.months || {}) };
      delete next[x.key];
      return { ...d, months: next };
    });
  };
  const setPlanRow = (m, patch) => setData((d) => ({
    ...d,
    plan: (d.plan || []).map((p) => (p.m === m ? { ...p, ...patch } : p)),
  }));

  const doneCount = months.filter((x) => monthTidyDone(data.months?.[x.key])).length;
  const startedCount = chosenTidyMonths(data).length;

  // 학년도 바꾸기 — 해마다 자료를 따로 보관한다 (작년 자료를 만든 뒤 올해 자료를 이어서 만들 수 있게. 2026-09-19)
  // 지금 해의 자료는 그대로 남고, 고른 해의 자료(없으면 빈 화면)가 나온다. 전체 문서에는 자료가 있는 해가 모두 들어간다.
  function changeYear(y) {
    setData((d) => switchTidyYear(d, y));
  }

  // 학년도를 잘못 골랐을 때 — 지금 해의 자료를 통째로 다른(비어 있는) 해로 옮긴다
  function moveYear(y) {
    if (!window.confirm(`지금 ${year}학년도에 올린 자료를 모두 ${y}학년도로 옮길까요?

(학년도를 잘못 골랐을 때만 쓰세요. 자료는 지워지지 않고 해만 바뀝니다.)`)) return;
    setData((d) => {
      const before = monthList(d.year || '2026');
      const after = monthList(y);
      const next = { ...(d.months || {}) };
      before.forEach((x, i) => {
        if (d.months?.[x.key]) { next[after[i].key] = d.months[x.key]; delete next[x.key]; }
      });
      const archive = { ...(d.archive || {}) };
      delete archive[y];
      return { ...d, year: y, months: next, archive };
    });
  }

  function restart() {
    if (!window.confirm('올린 자료와 정리한 내용을 모두 지우고 처음부터 다시 할까요?\n\n지우면 되돌릴 수 없습니다.')) return;
    clearForm(KEY);
    setDocState(DOC_ID, null);
    setData(emptyTidyData());
    setDone(false);
    go({ v: 'pick' });
  }

  // ── 파일에서 글자 뽑기 (여러 개를 이어서 올릴 수 있다) ──
  async function readFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return null;
    let added = '';
    const names = [];
    for (const f of files) {
      const text = await extractTextFromFile(f);
      if (!text.trim()) throw new Error(`${f.name}에서 글자를 찾지 못했습니다.`);
      added += `${added ? '\n\n' : ''}[${f.name}]\n${text}`;
      names.push(f.name);
    }
    return { added, names };
  }

  async function pickPlan(fileList) {
    setErr(''); setBusy('planfile');
    try {
      const r = await readFiles(fileList);
      if (!r) return;
      setData((d) => ({
        ...d,
        planSrc: d.planSrc ? `${d.planSrc}\n\n${r.added}` : r.added,
        planFiles: [...fileArr(d.planFiles), ...r.names],
      }));
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally { setBusy(''); }
  }

  async function pickRecord(kind, fileList) {
    setErr(''); setBusy(kind);
    try {
      const r = await readFiles(fileList);
      if (!r) return;
      if (kind === 'record') {
        upd({ src: cur.src ? `${cur.src}\n\n${r.added}` : r.added, files: [...fileArr(cur.files), ...r.names] });
      } else {
        upd({ etcSrc: cur.etcSrc ? `${cur.etcSrc}\n\n${r.added}` : r.added, etcFiles: [...fileArr(cur.etcFiles), ...r.names] });
      }
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally { setBusy(''); }
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy('photo');
    try {
      const room = MAX_PHOTOS - (cur.photos?.length || 0);
      const urls = await Promise.all(files.slice(0, room).map((f) => fileToResizedDataURL(f)));
      upd({ photos: [...(cur.photos || []), ...urls] });
    } catch {
      setErr('사진을 불러오지 못했습니다. 다른 사진으로 시도해 주세요.');
    } finally { setBusy(''); }
  }

  // ── AI 부르기 ──
  async function ask(kind, extra = {}) {
    setBusy(kind); setErr('');
    try {
      const res = await fetch('/api/program-tidy', {
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

  // 연간 운영계획 분석
  async function analyzePlan(again = false) {
    const j = await ask('plan', {
      planSrc: data.planSrc,
      ...(again && data.planFeedback?.trim()
        ? { previous: JSON.stringify({ months: data.plan }), feedback: data.planFeedback } : {}),
    });
    const r = j?.result;
    if (!r) return;
    const rows = (Array.isArray(r.months) ? r.months : [])
      .filter((x) => MONTH_SEQ.includes(Number(x?.m)))
      .map((x) => ({
        m: Number(x.m),
        theme: String(x.theme || ''), target: String(x.target || ''),
        method: String(x.method || ''), content: String(x.content || ''),
      }))
      .sort((a, b) => MONTH_SEQ.indexOf(a.m) - MONTH_SEQ.indexOf(b.m));
    setData((d) => ({
      ...d,
      plan: rows.length ? rows : d.plan,
      planMissing: [
        ...(/^\d{4}$/.test(String(r.year || '')) && String(r.year) !== (d.year || '2026')
          ? [`올린 계획서는 ${r.year}년도 것으로 보입니다. 지금 고른 학년도는 ${d.year || '2026'}년도입니다 — 목록 화면의 학년도를 확인해 주세요.`] : []),
        ...(Array.isArray(r.missing) ? r.missing : []),
      ],
      planAnalyzed: true,
      planFeedback: '',
    }));
  }

  // 그 달 실시기록 분석 (평가 포함)
  async function analyzeRecord(again = false) {
    const j = await ask('record', {
      month: mi.label,
      planText: [curPlan.theme, curPlan.content].filter(Boolean).join(' — '),
      recordSrc: cur.src,
      etcSrc: cur.etcSrc,
      ...(again && cur.analyzeFeedback?.trim()
        ? { previous: JSON.stringify({ summary: cur.summary, review: cur.review, flow: cur.flow }), feedback: cur.analyzeFeedback }
        : {}),
    });
    const r = j?.result;
    if (!r) return;
    const flow = (Array.isArray(r.flow) ? r.flow : [])
      .filter((f) => f && (f.time || f.content))
      .map((f) => ({ time: String(f.time || ''), content: String(f.content || '') }));
    upd({
      theme: r.theme || cur.theme || curPlan.theme || '',
      date: r.date || cur.date,
      time: r.time || cur.time,
      place: r.place || cur.place,
      target: r.target || cur.target,
      parents: r.parents ?? cur.parents,
      kids: r.kids ?? cur.kids,
      staff: r.staff ?? cur.staff,
      flow: flow.length ? flow : cur.flow,
      summary: r.summary || '',
      review: r.review || '',
      missing: Array.isArray(r.missing) ? r.missing : [],
      analyzed: true,
      analyzeFeedback: '',
    });
  }

  // 평가만 다시 쓰기
  async function remakeReview() {
    const j = await ask('record', {
      month: mi.label,
      planText: [curPlan.theme, curPlan.content].filter(Boolean).join(' — '),
      recordSrc: cur.src,
      etcSrc: cur.etcSrc,
      previous: cur.review,
      feedback: cur.reviewFeedback,
    });
    const r = j?.result;
    if (r?.review) upd({ review: r.review, reviewFeedback: '' });
  }

  // 필요성
  async function makeNeed() {
    const planText = (data.plan || []).filter((p) => p.theme).map((p) => `${monthLabel(year, p.m)} ${p.theme}`).join(' / ');
    const j = await ask('need', {
      planText,
      ...(data.need && data.needFeedback?.trim() ? { previous: data.need, feedback: data.needFeedback } : {}),
    });
    if (j?.text) setData((d) => ({ ...d, need: j.text, needFeedback: '' }));
  }

  // ── 전체 문서를 보고 고칠 부분 반영 ──
  async function reviseDoc() {
    const picks = rangeTidyMonths(data, range);
    const docText = [
      `[필요성]\n${data.need || '(아직 쓰지 않음)'}`,
      ...picks.map((x) => {
        const m = tidyMonthOf(data, x.key);
        return `[${x.key} · ${x.label} ${themeOf(data, x)}]\n진행내용: ${m.summary || '(없음)'}\n평가: ${m.review || '(없음)'}`;
      }),
    ].join('\n\n');

    const j = await ask('revise', { docText, request: data.reviseFeedback });
    const r = j?.result;
    if (!r) return;

    setData((d) => {
      const nextMonths = { ...d.months };
      (Array.isArray(r.months) ? r.months : []).forEach((x) => {
        const k = String(x?.key || '');
        if (!k || !nextMonths[k]) return;
        const patch = {};
        if (String(x.summary || '').trim()) patch.summary = x.summary;
        if (String(x.review || '').trim()) patch.review = x.review;
        if (Object.keys(patch).length) nextMonths[k] = { ...nextMonths[k], ...patch };
      });
      const log = [
        ...(Array.isArray(r.changed) ? r.changed : []),
        ...(String(r.note || '').trim() ? [`※ ${r.note}`] : []),
      ];
      return {
        ...d,
        need: String(r.need || '').trim() ? r.need : d.need,
        months: nextMonths,
        reviseFeedback: '',
        reviseLog: log.length ? log : ['고칠 내용을 찾지 못했습니다. 조금 더 자세히 적어 주세요.'],
      };
    });
  }

  // ── 문서 조립 ──
  const blocks = view.v === 'save'
    ? buildProgramTidyDoc(data, basic || {}, range)
    : buildOneMonthTidy(data, mi, basic || {});
  const picks = rangeTidyMonths(data, range);

  async function saveHwpx(only = null) {
    setBusy('hwpx'); setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const src = only === null ? buildProgramTidyDoc(data, basic || {}, range) : buildOneMonthTidy(data, only, basic || {});
      const tag = only === null ? (range === 'all' ? '' : `_${rangeInfo(range).label}`) : `_${only.label.replace(/\s/g, '')}`;
      const name = `${center || '어린이집'}_부모참여프로그램${tag}.hwpx`;
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(src), onProgress: setSaveMsg });
      downloadBlob(blob, name);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(''); }
  }

  const shortBy = photosShort(cur);
  const canAnalyze = !!cur.src?.trim() || !!cur.etcSrc?.trim();

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 문서 목록으로</button>

      {/* ───────── 목록 ───────── */}
      {view.v === 'pick' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 서류 정리</div>
            <h1>가지고 있는 자료로 정리하기</h1>
          </div>

          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>① 연간 운영계획</b>을 먼저 올리고, <b>② 3월부터 진행한 실시기록</b>을 차례로 올리면
              AI가 읽어서 <b>한 문서</b>로 정리해 드립니다.
            </p>
            <p className="hint" style={{ color: '#b3620a' }}>
              ⚠️ 심사에서 가장 많이 놓치는 부분입니다. <b>연간계획 없이 실시기록만</b> 있으면 5점이 아니라 <b>2점</b>만 인정됩니다.
            </p>

            {/* ① 연간계획 */}
            <button className={`plan-card ${data.plan?.length ? 'done' : ''}`} onClick={() => go({ v: 'plan' })}>
              <span className="plan-card-top">
                <b>① 연간 운영계획 올리기</b>
                <span className={`q-chip ${data.plan?.length ? 'ok' : ''}`}>
                  {data.plan?.length ? `완성 · ${data.plan.length}개월` : data.planSrc ? '작성 중' : '아직'}
                </span>
              </span>
              <span className="plan-card-desc">
                연간계획서를 <b>PDF</b>(또는 한글·워드)로 올리면 AI가 읽어서 표로 정리합니다.
              </span>
              <span className="doc-card-go">{data.planSrc ? '이어서 하기 →' : '계획서 올리기 →'}</span>
            </button>

            {/* ② 달별 실시기록 */}
            <h3 className="wiz-sub" style={{ marginTop: 22 }}>② 실시기록 올리기 <span className="tidy-once">3월부터 차례로</span></h3>
            <p className="hint">
              <b>월별로 하신 원</b>은 진행한 달을 모두, <b>분기별로 하신 원</b>은 그 분기에 진행한 달만 고르시면 됩니다.
              (열두 달을 다 채우지 않아도 됩니다)
            </p>
            <p className="hint" style={{ color: '#b3620a' }}>
              📷 달마다 <b>활동 사진 2장 이상</b>을 반드시 넣어 주세요. 사진이 없으면 실시했다는 증빙이 약해집니다.
            </p>

            <div className="q-grid month">
              {months.map((x, i) => {
                const m = data.months?.[x.key];
                const ok = monthTidyDone(m);
                const some = monthTidyHasContent(m);
                const p = planOf(data, x.m);
                const short = some && !ok ? photosShort(m) : 0;
                return (
                  <div key={x.key} className={`q-cardwrap ${m?.skip ? 'skipped' : ''}`}>
                  <button className={`q-card ${ok && !m?.skip ? 'done' : ''}`} onClick={() => go({ v: 'step', q: i, s: 'upload' })}>
                    <div className="q-top">
                      <b>{x.label}</b>
                      <span className={`q-chip ${ok && !m?.skip ? 'ok' : ''}`}>{m?.skip ? '문서에서 뺌' : ok ? '완성' : some ? '작성 중' : '아직'}</span>
                    </div>
                    <div className="q-when">{(m?.theme || p.theme) || '주제 미정'}</div>
                    {m?.date ? <div className="q-date">{whenText(m)}</div> : null}
                    {short > 0 && !m?.skip && <div className="q-date warn">📷 사진 {short}장 더 필요</div>}
                  </button>
                    {some && (
                      <div className="q-ctrl">
                        <button type="button" className={`q-skip ${m?.skip ? 'off' : ''}`} onClick={() => toggleSkip(x.key)}>
                          {m?.skip ? '☐ 문서에서 뺌 · 다시 넣기' : '☑ 문서에 넣는 중 · 빼기'}
                        </button>
                        <button type="button" className="q-del" onClick={() => removeMonth(x)}>🗑 지우기</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="hint">{startedCount}개 달이 문서에 들어가고, 그중 {doneCount}개 달이 완성됐습니다. 잘못 올린 달은 카드 아래의 <b>「빼기」</b>(자료는 두고 문서에만 안 넣기)나 <b>「지우기」</b>로 정리하세요.</p>
            <button className="next-doc" onClick={() => go({ v: 'save' })}>
              📚 전체 문서 만들기 (연간계획 + 실시기록) →
            </button>

            <div className="field" style={{ marginTop: 18 }}>
              <label>어린이집 이름 <span className="req">*</span></label>
              <input type="text" value={center} placeholder="예) 멘토어린이집" onChange={(e) => setCenter(e.target.value)} />
              {!center && <p className="hint" style={{ color: '#b4661a' }}>⚠️ 이름을 넣으면 모든 문서 제목에 자동으로 들어갑니다.</p>}
            </div>
            <div className="field">
              <label>학년도 (3월에 시작하는 해)</label>
              <div className="year-tabs">
                {tidyYearOptions(data).map((y) => {
                  const n = tidyYearCount(data, y);
                  const has = tidyYearsWithContent(data).includes(y);
                  return (
                    <button key={y} type="button" className={`year-tab ${y === year ? 'on' : ''}`} onClick={() => changeYear(y)}>
                      <b>{y}학년도</b>
                      <small>{y}년 3월 ~ {Number(y) + 1}년 2월</small>
                      <em>{n ? `자료 ${n}달` : (has ? '연간계획만' : '아직 없음')}</em>
                    </button>
                  );
                })}
              </div>
              <p className="hint">
                💡 <b>작년 자료를 먼저 만들고, 학년도를 바꿔 올해 자료를 이어서 만드세요.</b> 해마다 따로 보관되며, 학년도를 바꿔도 앞서 만든 자료는 지워지지 않습니다.
                「전체 문서 만들기」에는 <b>자료가 있는 학년도가 모두</b> 앞선 해부터 차례로 들어갑니다.
              </p>
              {startedCount > 0 && tidyYearOptions(data).some((y) => y !== year && !tidyYearsWithContent(data).includes(y)) && (
                <p className="hint">
                  학년도를 잘못 골랐다면:{' '}
                  {tidyYearOptions(data).filter((y) => y !== year && !tidyYearsWithContent(data).includes(y)).map((y) => (
                    <button key={y} type="button" className="linkish" onClick={() => moveYear(y)}>지금 자료를 {y}학년도로 옮기기</button>
                  ))}
                </p>
              )}
            </div>

            <div className="wiz-nav">
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
            </div>
          </div>
        </>
      )}

      {/* ───────── ① 연간 운영계획 ───────── */}
      {view.v === 'plan' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 서류 정리 · ①</div>
            <h1>연간 운영계획 올리기</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'pick' })}>← 목록으로</button>

          {err && <p className="error">⚠️ {err}</p>}

          <div className="card wiz-card">
            <p className="wiz-lead">
              가지고 있는 <b>{year}년도 부모참여프로그램 연간 운영계획</b>을 올려 주세요.
            </p>
            <p className="hint">
              <b>PDF</b> · 한글(hwpx) · 워드(docx) · 텍스트 파일을 올릴 수 있습니다.
              여러 장으로 나뉘어 있으면 <b>이어서 여러 개</b> 올리셔도 됩니다.
            </p>
            <p className="tidy-note">
              ⚠️ 그림으로 스캔한 PDF는 글자를 읽을 수 없습니다. 한글에서 만든 파일이면 <b>hwpx</b>나 <b>PDF로 내보내기</b>로 저장해 올려 주세요.
            </p>

            <div className="tidy-src">
              <label className="file-btn">
                {busy === 'planfile' ? '읽는 중…' : (fileArr(data.planFiles).length ? '📎 계획서 더 올리기' : '📎 연간 운영계획 올리기 (PDF·한글·워드)')}
                <input type="file" accept=".hwpx,.docx,.pdf,.txt" multiple hidden disabled={!!busy}
                  onChange={(e) => { pickPlan(e.target.files); e.target.value = ''; }} />
              </label>
              {fileArr(data.planFiles).length > 0 && (
                <>
                  <span className="tidy-file">✔ {fileArr(data.planFiles).join(' · ')}</span>
                  <button type="button" className="ghost sm" style={{ marginLeft: 8 }}
                    onClick={() => setData((d) => ({ ...d, planSrc: '', planFiles: [] }))}>비우기</button>
                </>
              )}
              {data.planSrc && (
                <details className="tidy-peek">
                  <summary>올린 내용 보기 · 고치기 ({data.planSrc.length.toLocaleString()}자)</summary>
                  <textarea rows={10} value={data.planSrc} onChange={(e) => setData((d) => ({ ...d, planSrc: e.target.value }))} />
                </details>
              )}
            </div>

            <button className="primary" onClick={() => analyzePlan(false)} disabled={!!busy || !data.planSrc?.trim()}>
              {busy === 'plan' ? 'AI가 계획서를 읽는 중입니다…' : `🤖 ${data.planAnalyzed ? '다시 ' : ''}계획서 읽어서 표로 정리하기`}
            </button>
            {!data.planSrc?.trim() && <p className="hint">계획서를 올리면 정리할 수 있습니다.</p>}

            {(data.planMissing || []).length > 0 && (
              <div className="tidy-missing">
                <h4>⚠️ 계획서에서 찾지 못한 것</h4>
                <ul>{data.planMissing.map((t, i) => <li key={i}>{t}</li>)}</ul>
                <p className="hint">아래 표에서 직접 채워 넣으시면 됩니다.</p>
              </div>
            )}
          </div>

          {!!data.plan?.length && (
            <div className="card wiz-card">
              <h2 className="wiz-sub">연간계획표 <span className="edit-badge">✏️ 칸을 눌러 바로 고치세요</span></h2>
              <div className="plan-head">
                <span>시기</span><span>주제(프로그램명)</span><span>대상</span><span>운영 방법</span><span>주요 내용</span>
              </div>
              {data.plan.map((p) => (
                <div className="plan-row" key={p.m}>
                  <span className="plan-m">{monthLabel(year, p.m)}</span>
                  <input type="text" value={p.theme} placeholder="주제" onChange={(e) => setPlanRow(p.m, { theme: e.target.value })} />
                  <input type="text" value={p.target} placeholder="대상" onChange={(e) => setPlanRow(p.m, { target: e.target.value })} />
                  <input type="text" value={p.method} placeholder="운영 방법" onChange={(e) => setPlanRow(p.m, { method: e.target.value })} />
                  <input type="text" value={p.content} placeholder="주요 내용" onChange={(e) => setPlanRow(p.m, { content: e.target.value })} />
                </div>
              ))}
              <button type="button" className="ghost sm" style={{ marginTop: 8 }}
                onClick={() => setData((d) => {
                  const used = (d.plan || []).map((p) => p.m);
                  const m = MONTH_SEQ.find((x) => !used.includes(x));
                  if (!m) return d;
                  return {
                    ...d,
                    plan: [...d.plan, { m, theme: '', target: '', method: '', content: '' }]
                      .sort((a, b) => MONTH_SEQ.indexOf(a.m) - MONTH_SEQ.indexOf(b.m)),
                  };
                })}>
                ＋ 빠진 달 추가
              </button>

              <div className="field" style={{ marginTop: 12 }}>
                <label>표를 통째로 고치고 싶으면 알려주세요 (선택)</label>
                <input type="text" value={data.planFeedback || ''} placeholder="예) 6월 주제는 아빠 참여 물놀이입니다. 대상 칸을 모두 채워주세요."
                  onChange={(e) => setData((d) => ({ ...d, planFeedback: e.target.value }))} />
                {data.planFeedback?.trim() && (
                  <button className="ghost" onClick={() => analyzePlan(true)} disabled={!!busy}>🔁 고친 내용으로 다시 정리하기</button>
                )}
              </div>

              <button className="next-doc" onClick={() => go({ v: 'pick' })}>✅ 계획 확인 완료 · 실시기록 올리러 가기 →</button>
            </div>
          )}
        </>
      )}

      {/* ───────── ② 달별 단계 ───────── */}
      {view.v === 'step' && (
        <>
          <div className="wiz-head">
            <div className="wiz-bar"><span style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} /></div>
            <div className="wiz-count">{stepIdx + 1} / {STEPS.length} 단계 · {mi.label} ({mi.quarter})</div>
            <h1>{STEP_TITLE[view.s]}</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'pick' })}>← 달 목록으로</button>

          {err && <p className="error">⚠️ {err}</p>}

          {/* 1. 자료 올리기 */}
          {view.s === 'upload' && (
            <div className="card wiz-card">
              <p className="wiz-lead">
                <b>{mi.label}</b>에 진행한 부모참여프로그램의 <b>실시기록</b>을 올려 주세요.
                {curPlan.theme && <> 연간계획에는 <b>{curPlan.theme}</b>으로 되어 있습니다.</>}
              </p>
              <p className="hint">한글(hwpx) · 워드(docx) · PDF · 텍스트 파일을 올릴 수 있습니다. 여러 개를 이어서 올리셔도 됩니다.</p>

              <div className="tidy-sec">
                <h4>1. 실시기록 (결과보고서)</h4>
                <p className="hint">그날의 진행 내용·참석 인원이 적힌 문서를 올려 주세요.</p>
                <div className="tidy-src">
                  <label className="file-btn">
                    {busy === 'record' ? '읽는 중…' : (fileArr(cur.files).length ? '📎 파일 더 올리기' : '📎 실시기록 올리기')}
                    <input type="file" accept=".hwpx,.docx,.pdf,.txt" multiple hidden disabled={!!busy}
                      onChange={(e) => { pickRecord('record', e.target.files); e.target.value = ''; }} />
                  </label>
                  {fileArr(cur.files).length > 0 && (
                    <>
                      <span className="tidy-file">✔ {fileArr(cur.files).join(' · ')}</span>
                      <button type="button" className="ghost sm" style={{ marginLeft: 8 }} onClick={() => upd({ src: '', files: [] })}>비우기</button>
                    </>
                  )}
                  {cur.src && (
                    <details className="tidy-peek">
                      <summary>올린 내용 보기 · 고치기 ({cur.src.length.toLocaleString()}자)</summary>
                      <textarea rows={8} value={cur.src} onChange={(e) => upd({ src: e.target.value })} />
                    </details>
                  )}
                </div>
              </div>

              <div className="tidy-sec">
                <h4>2. 그 밖의 자료 <span className="tidy-once">선택</span></h4>
                <p className="hint">부모님께 보낸 공지문(가정통신문)·신청서·참석 명단 등이 있으면 함께 올려 주세요. AI가 함께 읽고 더 정확히 정리합니다.</p>
                <div className="tidy-src">
                  <label className="file-btn">
                    {busy === 'etc' ? '읽는 중…' : (fileArr(cur.etcFiles).length ? '📎 파일 더 올리기' : '📎 공지문 등 올리기')}
                    <input type="file" accept=".hwpx,.docx,.pdf,.txt" multiple hidden disabled={!!busy}
                      onChange={(e) => { pickRecord('etc', e.target.files); e.target.value = ''; }} />
                  </label>
                  {fileArr(cur.etcFiles).length > 0 && (
                    <>
                      <span className="tidy-file">✔ {fileArr(cur.etcFiles).join(' · ')}</span>
                      <button type="button" className="ghost sm" style={{ marginLeft: 8 }} onClick={() => upd({ etcSrc: '', etcFiles: [] })}>비우기</button>
                    </>
                  )}
                  {cur.etcSrc && (
                    <details className="tidy-peek">
                      <summary>올린 내용 보기 · 고치기 ({cur.etcSrc.length.toLocaleString()}자)</summary>
                      <textarea rows={6} value={cur.etcSrc} onChange={(e) => upd({ etcSrc: e.target.value })} />
                    </details>
                  )}
                </div>
              </div>

              <div className="tidy-sec">
                <h4>3. 활동 사진 <span className="tidy-once">{MIN_PHOTOS}장 이상 필수</span></h4>
                <p className="hint">
                  실시기록에는 <b>사진이 꼭 들어가야</b> 합니다. 그날 찍은 사진을 <b>{MIN_PHOTOS}장 이상</b>(최대 {MAX_PHOTOS}장) 넣어 주세요.
                </p>
                <div className="img-grid">
                  {(cur.photos || []).map((src, i) => (
                    <div className="img-thumb sm" key={i}>
                      <img src={src} alt="" />
                      <button type="button" className="img-del" onClick={() => upd({ photos: cur.photos.filter((_, x) => x !== i) })}>✕</button>
                    </div>
                  ))}
                  {(cur.photos?.length || 0) < MAX_PHOTOS && (
                    <label className={`img-upload sm ${busy === 'photo' ? 'busy' : ''}`}>
                      {busy === 'photo' ? '불러오는 중…' : '＋ 사진 추가'}
                      <input type="file" accept="image/*" multiple hidden disabled={!!busy}
                        onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                {shortBy > 0
                  ? <p className="hint" style={{ color: '#b3620a' }}>📷 <b>{shortBy}장</b> 더 넣어 주세요. (지금 {(cur.photos || []).length}장)</p>
                  : <p className="hint" style={{ color: '#2E7D68' }}>✔ 사진 {(cur.photos || []).length}장이 들어 있습니다.</p>}
              </div>

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 달 목록</button>
                <button className="primary" onClick={next} disabled={!canAnalyze || shortBy > 0}>다음 · AI로 분석하기 →</button>
              </div>
              {!canAnalyze && <p className="hint">실시기록 자료를 올리면 다음으로 넘어갈 수 있습니다.</p>}
              {canAnalyze && shortBy > 0 && (
                <p className="hint">
                  사진 {shortBy}장을 더 넣으면 넘어갈 수 있습니다.{' '}
                  <button type="button" className="linkish" onClick={next}>사진은 나중에 넣고 먼저 정리하기</button>
                </p>
              )}
            </div>
          )}

          {/* 2. AI 분석 */}
          {view.s === 'analyze' && (
            <div className="card wiz-card">
              <p className="wiz-lead">
                올린 자료를 AI가 읽어서 <b>운영일시 · 장소 · 대상 · 참석인원 · 진행 순서 · 진행내용</b>으로 나눠 정리하고,
                <b> 평가</b>는 그 기록을 근거로 분석해 써 드립니다.
              </p>
              <p className="hint">자료에 없는 내용은 <b>지어내지 않고 비워 두고</b>, 무엇이 없었는지 알려드립니다.</p>

              <button className="primary" onClick={() => analyzeRecord(false)} disabled={!!busy}>
                {busy === 'record' ? 'AI가 분석 중입니다…' : `🤖 ${cur.analyzed ? '다시 ' : ''}${mi.label} 실시기록 분석하기`}
              </button>

              {cur.analyzed && (
                <>
                  <div className="tidy-sum">
                    <h4>읽어낸 내용</h4>
                    <table className="doc-kv">
                      <tbody>
                        <tr><th>프로그램명</th><td>{cur.theme || '— (자료에서 못 찾음)'}</td></tr>
                        <tr><th>운영 일시</th><td>{whenText(cur) || '— (자료에서 못 찾음)'}</td></tr>
                        <tr><th>장소</th><td>{cur.place || '—'}</td></tr>
                        <tr><th>대상</th><td>{cur.target || '—'}</td></tr>
                        <tr><th>참석자</th><td>{attendText(cur) || '—'}</td></tr>
                        <tr><th>진행 순서</th><td>{flowList(cur).length ? `${flowList(cur).length}줄` : '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {(cur.missing || []).length > 0 && (
                    <div className="tidy-missing">
                      <h4>⚠️ 자료에서 찾지 못해 비워 둔 것</h4>
                      <ul>{cur.missing.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      <p className="hint">다음 단계에서 직접 채워 넣으시면 됩니다.</p>
                    </div>
                  )}

                  <div className="field" style={{ marginTop: 14 }}>
                    <label>고칠 부분이 있으면 적어주세요 (다시 분석합니다)</label>
                    <textarea rows={3} value={cur.analyzeFeedback || ''}
                      placeholder="예) 참석 인원은 부모 22명, 영유아 25명입니다. 진행 순서에 마무리 소감 나누기를 넣어주세요."
                      onChange={(e) => upd({ analyzeFeedback: e.target.value })} />
                    <button className="ghost" onClick={() => analyzeRecord(true)} disabled={!!busy || !cur.analyzeFeedback?.trim()}>
                      ↻ 고쳐서 다시 분석하기
                    </button>
                  </div>
                </>
              )}

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next} disabled={!cur.analyzed}>다음 · 확인하고 고치기 →</button>
              </div>
            </div>
          )}

          {/* 3. 확인·수정 */}
          {view.s === 'check' && (
            <div className="card wiz-card">
              <div className="wiz-result-top">
                <span>AI가 정리한 내용입니다</span>
                <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span>
              </div>

              <div className="tidy-sec">
                <h4>기본 정보</h4>
                <div className="field">
                  <label>프로그램명</label>
                  <input type="text" value={cur.theme} placeholder="예) 아빠와 함께하는 그림책 놀이" onChange={(e) => upd({ theme: e.target.value })} />
                </div>
                <div className="wiz-2col">
                  <div className="field">
                    <label>운영 날짜</label>
                    <input type="date" value={cur.date} onChange={(e) => upd({ date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>시각</label>
                    <input type="text" value={cur.time} placeholder="예) 오전 10시 ~ 11시 30분" onChange={(e) => upd({ time: e.target.value })} />
                  </div>
                </div>
                <div className="wiz-2col">
                  <div className="field">
                    <label>장소</label>
                    <input type="text" value={cur.place} placeholder="예) 어린이집 유희실" onChange={(e) => upd({ place: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>대상</label>
                    <input type="text" value={cur.target} placeholder="예) 만 3세반 부모 및 영유아" onChange={(e) => upd({ target: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>참석 인원 (없는 칸은 비워 두면 문서에 안 나옵니다)</label>
                  <div className="wiz-3col">
                    <input type="text" inputMode="numeric" value={cur.parents} placeholder="부모 ○명" onChange={(e) => upd({ parents: e.target.value })} />
                    <input type="text" inputMode="numeric" value={cur.kids} placeholder="영유아 ○명" onChange={(e) => upd({ kids: e.target.value })} />
                    <input type="text" inputMode="numeric" value={cur.staff} placeholder="교직원 ○명" onChange={(e) => upd({ staff: e.target.value })} />
                  </div>
                  <p className="hint">{attendText(cur) ? `→ 문서에는 ${attendText(cur)} 로 들어갑니다.` : '→ 숫자를 넣으면 문서 표에 들어갑니다.'}</p>
                </div>
              </div>

              <div className="tidy-sec">
                <h4>진행 순서 (시간 · 운영 내용)</h4>
                {(cur.flow || []).map((f, i) => (
                  <div className="flow-row" key={i}>
                    <input type="text" className="flow-time" value={f.time || ''} placeholder="시간"
                      onChange={(e) => upd({ flow: cur.flow.map((x, n) => (n === i ? { ...x, time: e.target.value } : x)) })} />
                    <textarea rows={2} value={f.content || ''} placeholder="무엇을 했는지"
                      onChange={(e) => upd({ flow: cur.flow.map((x, n) => (n === i ? { ...x, content: e.target.value } : x)) })} />
                    <button type="button" className="mem-del" onClick={() => upd({ flow: cur.flow.filter((_, n) => n !== i) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="ghost sm" onClick={() => upd({ flow: [...(cur.flow || []), { time: '', content: '' }] })}>
                  ＋ 줄 추가
                </button>
              </div>

              <div className="tidy-sec">
                <h4>부모참여프로그램 진행내용</h4>
                <textarea rows={7} value={cur.summary} onChange={(e) => upd({ summary: e.target.value })} />
              </div>

              <div className="tidy-sec">
                <h4>평가 <span className="edit-badge">🤖 올린 실시기록을 보고 AI가 분석했습니다</span></h4>
                <textarea rows={7} value={cur.review} onChange={(e) => upd({ review: e.target.value })} />
                <div className="field" style={{ marginTop: 8 }}>
                  <label>평가를 고치고 싶으면 알려주세요</label>
                  <input type="text" value={cur.reviewFeedback || ''} placeholder="예) 아버지 참여가 많았다는 점과 주차 문제를 넣어주세요"
                    onChange={(e) => upd({ reviewFeedback: e.target.value })} />
                  {cur.reviewFeedback?.trim() && (
                    <button className="ghost" onClick={remakeReview} disabled={!!busy}>🔁 평가만 다시 쓰기</button>
                  )}
                </div>
              </div>

              {shortBy > 0 && (
                <div className="tidy-missing">
                  <h4>📷 사진이 {shortBy}장 부족합니다</h4>
                  <p className="hint">이전 단계로 돌아가 사진을 넣어 주세요. 실시기록은 사진 2장 이상이 있어야 증빙이 됩니다.</p>
                  <button className="ghost sm" onClick={() => goStep('upload')}>사진 넣으러 가기 →</button>
                </div>
              )}

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next}>다음 · 정리본 보기 →</button>
              </div>
            </div>
          )}

          {/* 4. 이 달 정리본 */}
          {view.s === 'done' && (
            <>
              <div className="card wiz-card">
                <p className="wiz-lead">
                  <b>{mi.label}</b> 실시기록 정리본입니다. 확인하시고 이 달만 따로 저장할 수도 있습니다.
                </p>
                {shortBy > 0 && (
                  <p className="hint" style={{ color: '#b3620a' }}>📷 사진이 {shortBy}장 부족합니다. 이전 단계에서 넣어 주세요.</p>
                )}
                <div className="wiz-nav">
                  <button className="primary" onClick={() => window.print()}>🖨️ {mi.label}만 PDF로 저장</button>
                  <button className="ghost" onClick={() => saveHwpx(mi)} disabled={!!busy}>📄 {mi.label}만 한글(hwpx)로 저장</button>
                </div>
                {saveMsg && <p className="hint">{saveMsg}</p>}

                {q < months.length - 1 ? (
                  <button className="next-doc" onClick={() => go({ v: 'step', q: q + 1, s: 'upload' })}>
                    ✅ 확인했습니다 · {months[q + 1].label} 이어서 정리하기 →
                  </button>
                ) : (
                  <button className="next-doc" onClick={() => go({ v: 'save' })}>
                    📚 마지막 달입니다 · 전체 문서 만들기 →
                  </button>
                )}
                <button className="next-doc calm" onClick={() => go({ v: 'save' })}>
                  📄 여기까지 만든 것으로 전체 문서 만들기
                </button>
                <div className="wiz-nav">
                  <button className="ghost" onClick={prev}>← 이전</button>
                  <button className="ghost" onClick={() => go({ v: 'pick' })}>달 목록</button>
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
        </>
      )}

      {/* ───────── ③ 전체 문서 ───────── */}
      {view.v === 'save' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 서류 정리 · 마지막</div>
            <h1>전체 문서 확인하고 저장하기</h1>
          </div>

          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>1. 필요성 → 2. 연간계획표 → 3. 달별 실시기록(사진 포함)</b> 순서로 한 문서에 묶었습니다.
            </p>

            {/* 필요성 */}
            <div className="tidy-sec">
              <h4>1. 부모참여프로그램의 필요성</h4>
              <button className="primary" onClick={makeNeed} disabled={!!busy}>
                {busy === 'need' ? 'AI가 쓰는 중입니다…' : `✍️ ${data.need ? '다시 ' : ''}필요성 쓰기`}
              </button>
              {data.need && (
                <>
                  <div className="wiz-result-top" style={{ marginTop: 10 }}>
                    <span>필요성</span>
                    <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span>
                  </div>
                  <textarea rows={7} value={data.need} onChange={(e) => setData((d) => ({ ...d, need: e.target.value }))} />
                </>
              )}
            </div>

            {/* 구간 고르기 */}
            <div className="tidy-sec">
              <h4>어느 구간을 담을까요?</h4>
              <div className="range-row">
                {RANGES.map((r) => {
                  const n = rangeTidyMonths(data, r.key).length;
                  return (
                    <button key={r.key} className={`range-chip ${range === r.key ? 'on' : ''}`} onClick={() => setRange(r.key)}>
                      {r.label} <em>{n}개 달</em>
                    </button>
                  );
                })}
              </div>
              <p className="hint">
                지금 고른 것 : <b>{rangeInfo(range).months ? rangeTitle(data, range) : '전체 (지금까지 올린 달 모두)'}</b> · 문서에{' '}
                <b>{rangeInfo(range).months ? picks.length : tidyYearsWithContent(data).reduce((n, y) => n + tidyYearCount(data, y), 0)}개 달</b>이 들어갑니다.
                {!rangeInfo(range).months && tidyYearsWithContent(data).length > 1 && (
                  <> (<b>{tidyYearsWithContent(data).map((y) => `${y}학년도`).join(' + ')}</b> 자료가 앞선 해부터 차례로 함께 들어갑니다. 분기별로 뽑을 때는 지금 고른 {year}학년도만 들어갑니다.)</>
                )}
              </p>
              {!data.plan?.length && (
                <p className="hint" style={{ color: '#b3620a' }}>
                  ⚠️ 연간 운영계획이 비어 있습니다. <button type="button" className="linkish" onClick={() => go({ v: 'plan' })}>계획서 올리러 가기</button>
                </p>
              )}
            </div>

            {err && <p className="error">⚠️ {err}</p>}

            <div className="wiz-nav">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (사진 포함)</button>
              <button className="ghost" onClick={() => saveHwpx()} disabled={!!busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            <p className="hint">한글 파일에는 <b>글은 고칠 수 있는 글자로</b>, 표·서식·그래프·사진은 <b>PDF와 같은 모양의 그림</b>으로 들어갑니다. 표 안의 글을 고치려면 여기서 고친 뒤 다시 저장하세요.</p>
          </div>

          {/* 아래 문서를 읽고 고칠 부분 요청 */}
          <div className="card wiz-card">
            <h3 className="wiz-sub">📝 아래 문서를 읽어 보시고, 고칠 부분을 알려주세요</h3>
            <p className="hint">
              적어 주시면 AI가 <b>필요성</b>과 <b>달별 진행내용·평가</b>에서 해당하는 곳을 찾아 고쳐 씁니다.
              (날짜·인원처럼 표에 들어가는 값은 그 달의 <b>확인·수정</b> 화면에서 고쳐 주세요)
            </p>
            <textarea rows={4} value={data.reviseFeedback || ''}
              placeholder={'예) 필요성에 우리 원 특색인 텃밭 활동을 넣어주세요.\n예) 5월 평가는 너무 짧아요. 부모 의견을 더 자세히 써주세요.\n예) 전체적으로 문장을 더 담백하게 다듬어주세요.'}
              onChange={(e) => setData((d) => ({ ...d, reviseFeedback: e.target.value }))} />
            <button className="primary" onClick={reviseDoc} disabled={!!busy || !data.reviseFeedback?.trim()}>
              {busy === 'revise' ? 'AI가 고치는 중입니다…' : '🤖 말씀하신 대로 고치기'}
            </button>

            {(data.reviseLog || []).length > 0 && (
              <div className="tidy-sum" style={{ marginTop: 12 }}>
                <h4>✅ 이렇게 고쳤습니다</h4>
                <ul>{data.reviseLog.map((t, i) => <li key={i}>{t}</li>)}</ul>
                <p className="hint">아래 미리보기에 바로 반영되어 있습니다. 더 고칠 것이 있으면 다시 적어 주세요.</p>
              </div>
            )}

            <button type="button" className={`done-btn ${done ? 'on' : ''}`} style={{ marginTop: 14 }} onClick={() => setDone((v) => !v)}>
              {done ? '✅ 작성 완료로 표시했습니다 (누르면 취소)' : '✅ 이 서류 작성 완료로 표시하기'}
            </button>
            <div className="wiz-nav">
              <button className="ghost" onClick={() => go({ v: 'pick' })}>← 달 목록으로</button>
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
