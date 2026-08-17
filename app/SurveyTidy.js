'use client';

// 부모만족도조사 "기존 서류 정리" (②번 길)
// 원장님이 정한 순서 그대로 5단계:
//   1. 조사 공지 올리기 → AI 분석
//   2. 조사 실시기간 (달력) + 조사 규모
//   3. 조사 내용 올리기 (ZIP으로 묶어서도 가능)
//   4. 분석한 결과 정리 (항목별 점수 + 그래프)
//   5. 전체 문서 확인·수정·저장
// 조사는 연 1회이므로 지난해(2025년) 자료를 정리한다.

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm, setDocState } from '../lib/store';
import { readAnyFile } from '../lib/extract';
import {
  AREAS, SRC_KINDS, emptyTidyData, listOf, tidyHasContent,
  buildSurveyTidyDoc, buildTidyResultDoc, buildTidyNoticeDoc, docTextOf,
  periodText, replyRate, scoreOf, totalScore, hasScores, bestArea, worstArea,
  toHwpxBlocks,
} from '../lib/surveyTidyDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'survey-tidy';
const DOC_ID = 'survey-tidy';

const STEPS = ['notice', 'period', 'content', 'result', 'save'];
const STEP_TITLE = {
  notice: '1. 부모만족도 조사 공지 올리기',
  period: '2. 조사 실시기간 정하기',
  content: '3. 부모만족도 조사 내용 올리기',
  result: '4. 분석한 결과 정리하기',
  save: '5. 전체 문서로 정리하기',
};

// 저장할 때 고를 수 있는 것
const SAVE_KINDS = [
  { k: 'all', label: '전체 문서 (제출용)' },
  { k: 'result', label: '결과서 (부모님 안내용)' },
  { k: 'notice', label: '조사 공지문' },
];

export default function SurveyTidy({ onBack }) {
  const [data, setData] = useState(emptyTidyData());
  const [basic, setBasic] = useState(null);
  const [step, setStep] = useState('notice');
  const [busy, setBusy] = useState('');
  const [busyMsg, setBusyMsg] = useState('');
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saveKind, setSaveKind] = useState('all');
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
        setData({
          ...emptyTidyData(),
          ...saved,
          src: { ...emptyTidyData().src, ...(saved.src || {}) },
          files: { ...emptyTidyData().files, ...(saved.files || {}) },
          skipped: { ...emptyTidyData().skipped, ...(saved.skipped || {}) },
          missing: { ...emptyTidyData().missing, ...(saved.missing || {}) },
          analyzed: { ...emptyTidyData().analyzed, ...(saved.analyzed || {}) },
        });
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
  const year = data.year || '2025';
  const idx = STEPS.indexOf(step);

  const upd = (patch) => setData((d) => ({ ...d, ...patch }));
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
    go('notice');
  }

  // ── 파일 올리기 (ZIP이면 안의 문서를 모두 읽는다) ──
  async function pickSrc(kind, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy(kind); setBusyMsg('파일을 읽는 중입니다…');
    try {
      let added = '';
      const names = [];
      const skipped = [];
      for (const f of files) {
        setBusyMsg(`${f.name} 읽는 중입니다…`);
        const r = await readAnyFile(f, (m) => setBusyMsg(m));
        added += `${added ? '\n\n' : ''}${r.text}`;
        names.push(...r.names);
        skipped.push(...(r.skipped || []));
      }
      setData((d) => ({
        ...d,
        src: { ...d.src, [kind]: d.src[kind] ? `${d.src[kind]}\n\n${added}` : added },
        files: { ...d.files, [kind]: [...listOf(d.files[kind]), ...names] },
        skipped: { ...d.skipped, [kind]: [...listOf(d.skipped[kind]), ...skipped] },
      }));
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally { setBusy(''); setBusyMsg(''); }
  }

  const clearSrc = (kind) => setData((d) => ({
    ...d,
    src: { ...d.src, [kind]: '' },
    files: { ...d.files, [kind]: [] },
    skipped: { ...d.skipped, [kind]: [] },
    analyzed: { ...d.analyzed, [kind]: false },
  }));

  // ── AI 부르기 ──
  async function ask(kind, extra = {}) {
    setBusy(kind); setErr('');
    try {
      const res = await fetch('/api/survey-tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, center, year, period: periodText(data), ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      return j;
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
      return null;
    } finally { setBusy(''); }
  }

  // 1. 공지 분석
  async function analyzeNotice(again = false) {
    const j = await ask('notice', {
      noticeSrc: data.src.notice,
      ...(again && data.noticeFeedback?.trim()
        ? { previous: JSON.stringify({ greeting: data.noticeGreeting, closing: data.noticeClosing }), feedback: data.noticeFeedback }
        : {}),
    });
    const r = j?.result;
    if (!r) return;
    setData((d) => ({
      ...d,
      noticeGreeting: r.greeting || d.noticeGreeting,
      noticeClosing: r.closing || d.noticeClosing,
      from: /^\d{4}-\d{2}-\d{2}$/.test(r.from || '') ? r.from : d.from,
      to: /^\d{4}-\d{2}-\d{2}$/.test(r.to || '') ? r.to : d.to,
      ways: Array.isArray(r.ways) && r.ways.length ? r.ways : d.ways,
      parents: r.parents || d.parents,
      copies: r.copies || d.copies,
      twins: r.twins || d.twins,
      missing: { ...d.missing, notice: Array.isArray(r.missing) ? r.missing : [] },
      analyzed: { ...d.analyzed, notice: true },
      noticeFeedback: '',
    }));
  }

  // 3·4. 조사 내용 분석
  async function analyzeContent(again = false) {
    const j = await ask('content', {
      contentSrc: data.src.content,
      size: `부모 ${data.parents || '?'}명 / 배부 ${data.copies || '?'}부 / 회신 ${data.replies || '?'}명`,
      memo: data.memo || '',
      ...(again && data.resultFeedback?.trim()
        ? { previous: JSON.stringify({ scores: data.scores, good: data.good, improve: data.improve, action: data.action }), feedback: data.resultFeedback }
        : {}),
    });
    const r = j?.result;
    if (!r) return;
    const nums = {};
    AREAS.forEach((a) => {
      const v = Number(r.scores?.[a.key]);
      if (Number.isFinite(v) && v > 0) nums[a.key] = Math.round(v * 10) / 10;
    });
    setData((d) => ({
      ...d,
      questions: Array.isArray(r.questions) ? r.questions.filter((q) => q?.text) : d.questions,
      qScores: Array.isArray(r.qScores)
        ? r.qScores.filter((q) => q?.text && Number(q.score) > 0).map((q) => ({ ...q, score: Math.round(Number(q.score) * 10) / 10 }))
        : d.qScores,
      scores: Object.keys(nums).length ? { ...d.scores, ...nums } : d.scores,
      parents: r.parents || d.parents,
      copies: r.copies || d.copies,
      replies: r.replies || d.replies,
      twins: r.twins || d.twins,
      good: r.good || d.good,
      improve: r.improve || d.improve,
      action: r.action || d.action,
      missing: { ...d.missing, content: Array.isArray(r.missing) ? r.missing : [] },
      analyzed: { ...d.analyzed, content: true },
      resultFeedback: '',
    }));
  }

  const scoreText = () => AREAS.map((a) => `${a.name} ${scoreOf(data, a.key).toFixed(1)}점`).join(' / ');

  async function makeNeed() {
    const j = await ask('need', data.need && data.needFeedback?.trim() ? { previous: data.need, feedback: data.needFeedback } : {});
    if (j?.text) upd({ need: j.text, needFeedback: '' });
  }

  async function makePlan() {
    const j = await ask('plan', {
      scoreText: scoreText(), memo: data.improve || '',
      ...(data.plan && data.planFeedback?.trim() ? { previous: data.plan, feedback: data.planFeedback } : {}),
    });
    if (j?.text) upd({ plan: j.text, planFeedback: '' });
  }

  // 5. 전체 문서를 보고 고칠 부분 반영
  async function reviseDoc() {
    const j = await ask('revise', { docText: docTextOf(data, center || '○○어린이집'), request: data.reviseFeedback });
    const r = j?.result;
    if (!r) return;
    setData((d) => {
      const nx = { ...d };
      ['need', 'noticeGreeting', 'noticeClosing', 'intro', 'good', 'improve', 'action', 'plan'].forEach((k) => {
        if (String(r[k] || '').trim()) nx[k] = r[k];
      });
      const log = [
        ...(Array.isArray(r.changed) ? r.changed : []),
        ...(String(r.note || '').trim() ? [`※ ${r.note}`] : []),
      ];
      nx.reviseFeedback = '';
      nx.reviseLog = log.length ? log : ['고칠 내용을 찾지 못했습니다. 조금 더 자세히 적어 주세요.'];
      return nx;
    });
  }

  // ── 문서 조립 ──
  const blocks = saveKind === 'result'
    ? buildTidyResultDoc(data, basic || {})
    : saveKind === 'notice'
      ? buildTidyNoticeDoc(data, basic || {})
      : buildSurveyTidyDoc(data, basic || {});

  async function saveHwpx() {
    setBusy('hwpx'); setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const tag = SAVE_KINDS.find((s) => s.k === saveKind)?.label || '';
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_${year}_학부모만족도조사_${tag.replace(/[ ()]/g, '')}.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(''); }
  }

  // 올린 자료 칸 (공통)
  const SrcBox = ({ k, label, hint, zip }) => {
    const names = listOf(data.files[k]);
    const skip = listOf(data.skipped[k]);
    return (
      <div className="tidy-src">
        <div className="tidy-src-top">
          <b>{label}</b>
          <span className="hint">{hint}</span>
        </div>
        <label className="file-btn">
          {busy === k ? (busyMsg || '읽는 중…') : (names.length ? '📎 파일 더 올리기' : `📎 ${label} 올리기`)}
          <input type="file" accept={zip ? '.zip,.hwpx,.docx,.pdf,.txt' : '.hwpx,.docx,.pdf,.txt,.zip'} multiple hidden disabled={!!busy}
            onChange={(e) => { pickSrc(k, e.target.files); e.target.value = ''; }} />
        </label>
        {names.length > 0 && (
          <>
            <span className="tidy-file">✔ {names.length}개 파일 읽음</span>
            <button type="button" className="ghost sm" style={{ marginLeft: 8 }} onClick={() => clearSrc(k)}>비우기</button>
            <details className="tidy-peek">
              <summary>읽은 파일 목록 보기 ({names.length}개)</summary>
              <p className="hint" style={{ marginTop: 6 }}>{names.join(' · ')}</p>
            </details>
          </>
        )}
        {skip.length > 0 && (
          <p className="hint" style={{ color: '#b3620a' }}>
            ⚠️ 글자를 읽지 못한 파일 {skip.length}개 (스캔 사진·옛 한글 등) — {skip.slice(0, 6).join(' · ')}{skip.length > 6 ? ' …' : ''}
          </p>
        )}
        {data.src[k] && (
          <details className="tidy-peek">
            <summary>올린 내용 보기 · 고치기 ({data.src[k].length.toLocaleString()}자)</summary>
            <textarea rows={10} value={data.src[k]}
              onChange={(e) => setData((d) => ({ ...d, src: { ...d.src, [k]: e.target.value } }))} />
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 문서 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-bar"><span style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="wiz-count">{idx + 1} / {STEPS.length} 단계 · 부모만족도조사 서류 정리</div>
        <h1>{STEP_TITLE[step]}</h1>
      </div>

      {err && <p className="error">⚠️ {err}</p>}

      {/* ───────── 1. 조사 공지 올리기 ───────── */}
      {step === 'notice' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            부모만족도 조사는 <b>연 1회</b>입니다. <b>{year}년에 실시한 자료</b>를 올려서 한 문서로 정리합니다.
          </p>

          <div className="wiz-2col">
            <div className="field">
              <label>어린이집 이름 <span className="req">*</span></label>
              <input type="text" value={center} placeholder="예) 멘토어린이집" onChange={(e) => setCenter(e.target.value)} />
            </div>
            <div className="field">
              <label>조사한 해</label>
              <select value={year} onChange={(e) => upd({ year: e.target.value })}>
                {['2024', '2025', '2026'].map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
          </div>
          {!center && <p className="hint" style={{ color: '#b4661a' }}>⚠️ 이름을 넣으면 모든 문서 제목에 자동으로 들어갑니다.</p>}

          <div className="tidy-sec">
            <h4>조사 공지 자료 올리기</h4>
            <p className="hint">
              조사 전에 부모님께 보낸 <b>가정통신문·키즈노트 공지</b> 등을 올려 주세요.
              한글(hwpx)·워드(docx)·PDF·텍스트를 올릴 수 있습니다.
            </p>
            <SrcBox {...SRC_KINDS[0]} />
          </div>

          <button className="primary" onClick={() => analyzeNotice(false)} disabled={!!busy || !data.src.notice?.trim()}>
            {busy === 'notice' ? 'AI가 공지를 읽는 중입니다…' : `🤖 ${data.analyzed.notice ? '다시 ' : ''}공지 읽어서 정리하기`}
          </button>
          {!data.src.notice?.trim() && <p className="hint">공지 자료를 올리면 정리할 수 있습니다.</p>}

          {(data.missing.notice || []).length > 0 && (
            <div className="tidy-missing">
              <h4>⚠️ 공지에서 찾지 못한 것</h4>
              <ul>{data.missing.notice.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <p className="hint">다음 단계에서 직접 채워 넣으시면 됩니다.</p>
            </div>
          )}

          {data.analyzed.notice && (
            <>
              <div className="wiz-result-top" style={{ marginTop: 14 }}>
                <span>AI가 정리한 공지문</span>
                <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span>
              </div>
              <div className="field">
                <label>인사말</label>
                <textarea rows={5} value={data.noticeGreeting} onChange={(e) => upd({ noticeGreeting: e.target.value })} />
              </div>
              <div className="field">
                <label>맺음말</label>
                <textarea rows={4} value={data.noticeClosing} onChange={(e) => upd({ noticeClosing: e.target.value })} />
              </div>
              <div className="field">
                <label>조사 방법 (한 줄에 하나씩)</label>
                <textarea rows={3} value={(data.ways || []).join('\n')}
                  onChange={(e) => upd({ ways: e.target.value.split('\n').filter((x) => x.trim()) })} />
              </div>
              <div className="field">
                <label>고칠 부분이 있으면 적어주세요 (다시 정리합니다)</label>
                <input type="text" value={data.noticeFeedback || ''} placeholder="예) 인사말을 더 짧게 해주세요"
                  onChange={(e) => upd({ noticeFeedback: e.target.value })} />
                {data.noticeFeedback?.trim() && (
                  <button className="ghost" onClick={() => analyzeNotice(true)} disabled={!!busy}>↻ 고쳐서 다시 정리하기</button>
                )}
              </div>
            </>
          )}

          <div className="wiz-nav">
            <button className="ghost" onClick={onBack}>← 문서 목록</button>
            <button className="primary" onClick={next}>다음 · 조사 기간 정하기 →</button>
          </div>
        </div>
      )}

      {/* ───────── 2. 조사 실시기간 ───────── */}
      {step === 'period' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            <b>{year}년</b>에 부모만족도 조사를 <b>언제부터 언제까지</b> 하셨는지 달력에서 골라 주세요.
          </p>
          {data.analyzed.notice && (data.from || data.to) && (
            <p className="hint" style={{ color: '#2E7D68' }}>✔ 올리신 공지에서 기간을 찾아 미리 넣어 두었습니다. 맞는지 확인해 주세요.</p>
          )}

          <div className="tidy-sec">
            <h4>조사 실시기간</h4>
            <div className="wiz-2col">
              <div className="field">
                <label>시작일</label>
                <input type="date" value={data.from || ''} onChange={(e) => upd({ from: e.target.value })} />
              </div>
              <div className="field">
                <label>마지막 날</label>
                <input type="date" value={data.to || ''} onChange={(e) => upd({ to: e.target.value })} />
              </div>
            </div>
            <p className="hint">{periodText(data) ? `→ 문서에는 ${periodText(data)} 로 들어갑니다.` : '→ 날짜를 고르면 문서에 들어갑니다.'}</p>
          </div>

          <div className="tidy-sec">
            <h4>조사 규모</h4>
            <p className="hint">아는 만큼만 넣으셔도 됩니다. 올리신 조사 자료에서 찾으면 다음 단계에서 자동으로 채워집니다.</p>
            <div className="wiz-3col">
              <div className="field">
                <label>부모 총 인원</label>
                <input type="text" inputMode="numeric" value={data.parents} placeholder="예) 48" onChange={(e) => upd({ parents: e.target.value })} />
              </div>
              <div className="field">
                <label>배부 부수</label>
                <input type="text" inputMode="numeric" value={data.copies} placeholder="예) 47" onChange={(e) => upd({ copies: e.target.value })} />
              </div>
              <div className="field">
                <label>회신 수</label>
                <input type="text" inputMode="numeric" value={data.replies} placeholder="예) 42" onChange={(e) => upd({ replies: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>인원 비고 (선택)</label>
              <input type="text" value={data.twins} placeholder="예) 쌍둥이 2명 포함" onChange={(e) => upd({ twins: e.target.value })} />
            </div>
            {replyRate(data) > 0 && <p className="hint">→ 회신율 <b>{replyRate(data)}%</b></p>}
          </div>

          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next} disabled={!data.from}>다음 · 조사 내용 올리기 →</button>
          </div>
          {!data.from && <p className="hint">시작일을 고르면 다음으로 넘어갈 수 있습니다.</p>}
        </div>
      )}

      {/* ───────── 3. 조사 내용 올리기 ───────── */}
      {step === 'content' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            실시한 <b>설문지와 회신된 응답 자료</b>를 올려 주세요.
          </p>
          <div className="tidy-note">
            📦 <b>응답이 많으면 ZIP(압축)으로 묶어 한 번에 올리세요.</b><br />
            여러 파일을 한 폴더에 모아 두고 <b>마우스 오른쪽 → 압축(보내기 → 압축 폴더)</b> 하시면 zip 파일이 만들어집니다.
            압축 안에 든 한글·워드·PDF·텍스트를 <b>모두 하나씩 열어서</b> 읽어 드립니다.
          </div>
          <p className="hint" style={{ color: '#b3620a' }}>
            ⚠️ <b>스캔한 사진(jpg·png)이나 옛 한글(.hwp)은 글자를 읽을 수 없습니다.</b>
            그런 자료뿐이라면 다음 단계에서 <b>영역별 점수를 직접 넣으시면</b> 그래프와 결과서가 완성됩니다.
          </p>

          <SrcBox {...SRC_KINDS[1]} zip />

          <div className="field">
            <label>부모님이 주신 의견·특이사항 (선택) — 적어주시면 개선 의견에 반영합니다</label>
            <textarea rows={4} value={data.memo || ''} onChange={(e) => upd({ memo: e.target.value })}
              placeholder={'예) 급식에 백김치를 더 넣어달라는 의견\n생일잔치를 월별로 했으면 좋겠다는 의견'} />
          </div>

          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next}>다음 · 결과 분석하기 →</button>
          </div>
        </div>
      )}

      {/* ───────── 4. 결과 분석 ───────── */}
      {step === 'result' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              올린 조사 내용을 AI가 읽어서 <b>영역별 평균 점수</b>를 내고 <b>그래프</b>로 정리합니다.
              <b> 잘된 점 · 개선 의견 · 조치사항</b>도 응답에서 뽑아 드립니다.
            </p>
            <p className="hint">자료로 계산할 수 없는 점수는 <b>0으로 비워 두고</b> 무엇이 없었는지 알려드립니다. 아래에서 직접 넣으셔도 됩니다.</p>

            <button className="primary" onClick={() => analyzeContent(false)} disabled={!!busy || !data.src.content?.trim()}>
              {busy === 'content' ? 'AI가 응답을 집계하는 중입니다…' : `🤖 ${data.analyzed.content ? '다시 ' : ''}조사 내용 분석하기`}
            </button>
            {!data.src.content?.trim() && (
              <p className="hint">조사 내용을 올리지 않으셨습니다. <button type="button" className="linkish" onClick={() => go('content')}>올리러 가기</button> 또는 아래에 점수를 직접 넣으세요.</p>
            )}

            {(data.missing.content || []).length > 0 && (
              <div className="tidy-missing">
                <h4>⚠️ 자료에서 찾지 못해 비워 둔 것</h4>
                <ul>{data.missing.content.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="card wiz-card">
            <h3 className="wiz-sub">영역별 평균 점수 <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span></h3>
            <p className="hint">매우만족 5점 / 만족 4점 / 보통 3점 / 불만 2점 / 매우불만 1점으로 환산한 평균입니다.</p>
            <div className="score-grid">
              {AREAS.map((a) => (
                <div className="score-row" key={a.key}>
                  <span className="score-name"><i style={{ background: a.color }} />{a.name}</span>
                  <input type="number" step="0.1" min="1" max="5" value={data.scores?.[a.key] ?? ''} placeholder="예) 4.5"
                    onChange={(e) => upd({ scores: { ...data.scores, [a.key]: e.target.value === '' ? '' : Number(e.target.value) } })} />
                  <span className="score-unit">점</span>
                </div>
              ))}
            </div>
            {hasScores(data) && (
              <p className="hint">→ <b>전체 만족도 평균 {totalScore(data).toFixed(1)}점</b> ·
                가장 높은 영역 <b>{bestArea(data).name}</b> · 가장 낮은 영역 <b>{worstArea(data).name}</b></p>
            )}

            {(data.qScores || []).length > 0 && (
              <details className="tidy-peek" style={{ marginTop: 12 }}>
                <summary>문항별 평균 점수 보기 · 고치기 ({data.qScores.length}문항)</summary>
                <div className="qscore-list">
                  {data.qScores.map((q, i) => (
                    <div className="qscore-row" key={i}>
                      <input type="text" value={q.text}
                        onChange={(e) => upd({ qScores: data.qScores.map((x, n) => (n === i ? { ...x, text: e.target.value } : x)) })} />
                      <input type="number" step="0.1" min="1" max="5" value={q.score}
                        onChange={(e) => upd({ qScores: data.qScores.map((x, n) => (n === i ? { ...x, score: Number(e.target.value) } : x)) })} />
                      <button type="button" className="mem-del" onClick={() => upd({ qScores: data.qScores.filter((_, n) => n !== i) })}>✕</button>
                    </div>
                  ))}
                </div>
                <p className="hint">문항별 표는 전체 문서 뒤쪽에 &lsquo;문항별 상세 분석&rsquo;으로 들어갑니다. 필요 없으면 모두 지우세요.</p>
              </details>
            )}
          </div>

          <div className="card wiz-card">
            <h3 className="wiz-sub">비고 (잘된 점 · 개선 의견 · 조치사항) <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span></h3>
            <div className="field">
              <label>잘된 점</label>
              <textarea rows={4} value={data.good} placeholder="- 운영의 개방성 부분에서 가장 높은 만족도를 보임" onChange={(e) => upd({ good: e.target.value })} />
            </div>
            <div className="field">
              <label>개선 의견</label>
              <textarea rows={5} value={data.improve} placeholder="- 어린이집 환경 만족도가 전체 평균보다 낮게 나타남" onChange={(e) => upd({ improve: e.target.value })} />
            </div>
            <div className="field">
              <label>어린이집 조치사항</label>
              <textarea rows={5} value={data.action} placeholder="▪ 시설·설비 및 실내외 환경이 개선될 수 있도록 노력하겠습니다." onChange={(e) => upd({ action: e.target.value })} />
            </div>
            <div className="field">
              <label>고칠 부분이 있으면 적어주세요 (다시 분석합니다)</label>
              <input type="text" value={data.resultFeedback || ''} placeholder="예) 급식 백김치 건의도 개선 의견에 넣어주세요"
                onChange={(e) => upd({ resultFeedback: e.target.value })} />
              {data.resultFeedback?.trim() && (
                <button className="ghost" onClick={() => analyzeContent(true)} disabled={!!busy}>↻ 고쳐서 다시 분석하기</button>
              )}
            </div>

            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="primary" onClick={next} disabled={!hasScores(data)}>다음 · 전체 문서 보기 →</button>
            </div>
            {!hasScores(data) && <p className="hint">점수를 하나라도 넣으면 다음으로 넘어갈 수 있습니다.</p>}
          </div>

          {hasScores(data) && (
            <div className="page-outer">
              <div className="print-area">
                <PrintSheet>
                  {buildTidyResultDoc(data, basic || {}).map((b, i) => <Block key={i} b={b} />)}
                </PrintSheet>
              </div>
            </div>
          )}
        </>
      )}

      {/* ───────── 5. 전체 문서 ───────── */}
      {step === 'save' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>1. 필요성 → 2. 조사 공지문 → 3. 설문지 → 4. 결과서{(data.qScores || []).length ? ' → 5. 문항별 상세 분석' : ''} → 마지막. 내년 반영 내용</b> 순서로 묶었습니다.
            </p>

            <div className="tidy-sec">
              <h4>1. 조사의 필요성</h4>
              <button className="primary" onClick={makeNeed} disabled={!!busy}>
                {busy === 'need' ? 'AI가 쓰는 중입니다…' : `✍️ ${data.need ? '다시 ' : ''}필요성 쓰기`}
              </button>
              {data.need && <textarea rows={7} style={{ marginTop: 10 }} value={data.need} onChange={(e) => upd({ need: e.target.value })} />}
              <p className="hint">비워 두시면 기본 문구가 들어갑니다. (매년 1회 조사로 투명하게 운영한다는 내용이 들어 있습니다)</p>
            </div>

            <div className="tidy-sec">
              <h4>마지막. 결과를 내년에 어떻게 반영할지</h4>
              <button className="primary" onClick={makePlan} disabled={!!busy}>
                {busy === 'plan' ? 'AI가 쓰는 중입니다…' : `✍️ ${data.plan ? '다시 ' : ''}내년 반영 내용 쓰기`}
              </button>
              {data.plan && <textarea rows={7} style={{ marginTop: 10 }} value={data.plan} onChange={(e) => upd({ plan: e.target.value })} />}
            </div>

            <div className="tidy-sec">
              <h4>무엇을 저장할까요?</h4>
              <div className="range-row">
                {SAVE_KINDS.map((s) => (
                  <button key={s.k} className={`range-chip ${saveKind === s.k ? 'on' : ''}`} onClick={() => setSaveKind(s.k)}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="wiz-nav">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (또는 인쇄)</button>
              <button className="ghost" onClick={saveHwpx} disabled={!!busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            <p className="hint">한글 파일에는 <b>글자만</b> 들어갑니다. 그래프는 PDF로 저장해 주세요.</p>
          </div>

          <div className="card wiz-card">
            <h3 className="wiz-sub">📝 아래 문서를 읽어 보시고, 고칠 부분을 알려주세요</h3>
            <p className="hint">
              적어 주시면 AI가 <b>필요성 · 공지문 · 설문 안내글 · 잘된 점 · 개선 의견 · 조치사항 · 내년 반영 내용</b>에서
              해당하는 곳을 찾아 고쳐 씁니다. (점수·인원은 앞 단계에서 고쳐 주세요)
            </p>
            <textarea rows={4} value={data.reviseFeedback || ''}
              placeholder={'예) 조치사항에 백김치 제공을 늘리겠다는 내용을 넣어주세요.\n예) 개선 의견이 너무 딱딱해요. 부드럽게 다듬어주세요.'}
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
