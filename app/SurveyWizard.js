'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import {
  AREAS, QUESTIONS, emptyData, periodText, replyRate,
  makeSampleScores, scoreOf, totalScore, hasScores, bestArea, worstArea,
  buildSurveyDoc, buildResultDoc, buildFormDoc, toHwpxBlocks,
} from '../lib/surveyDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'survey-wizard';

const STEPS = ['size', 'form', 'scores', 'result', 'save'];
const STEP_TITLE = {
  size: '조사 규모 정하기',
  form: '설문지 만들기',
  scores: '조사 결과 넣기',
  result: '결과보고서 만들기',
  save: '문서 저장하기',
};

export default function SurveyWizard({ onBack }) {
  const [data, setData] = useState(emptyData());
  const [basic, setBasic] = useState(null);
  const [step, setStep] = useState('size');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [memo, setMemo] = useState('');
  const loadedRef = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info')]).then(([saved, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (saved?.year) {
        setData({ ...emptyData(), ...saved });
        if (saved.step) setStep(saved.step);
        if (saved.memo) setMemo(saved.memo);
      }
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveForm(KEY, { ...data, step, memo }); }, 600);
    return () => clearTimeout(timer.current);
  }, [data, step, memo]);

  const center = basic?.centerName?.trim() || '';
  const upd = (patch) => setData((d) => ({ ...d, ...patch }));
  const go = (s) => { setErr(''); setStep(s); window.scrollTo(0, 0); };
  const idx = STEPS.indexOf(step);
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const prev = () => go(STEPS[Math.max(idx - 1, 0)]);

  // 기본사항의 원아 수로 부모 인원을 제안 (원아 1명당 보호자 1명 기준)
  const kidCount = (basic?.staff || []).flatMap((s) => s.classes || [])
    .reduce((n, c) => n + (c.children?.length || Number(c.count) || 0), 0);

  const scoreText = AREAS.map((a) => `${a.name} ${scoreOf(data, a.key).toFixed(1)}점`).join(' / ');

  async function ask(kind, extra = {}) {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, center, year: data.year,
          period: periodText(data),
          counts: `부모 총 ${data.parents}명 / 배부 ${data.copies}부 / 회신 ${data.replies}명 (회신율 ${replyRate(data)}%)`,
          scores: scoreText,
          best: bestArea(data)?.name,
          worst: worstArea(data)?.name,
          ...extra,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      return j;
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
      return null;
    } finally { setBusy(false); }
  }

  async function makeIntro() {
    const j = await ask('intro', data.intro && data.introFeedback
      ? { previous: data.intro, feedback: data.introFeedback } : {});
    if (j?.text) upd({ intro: j.text, introFeedback: '' });
  }

  async function makeResult() {
    if (!hasScores(data)) { setErr('먼저 조사 결과(점수)를 넣어주세요.'); return; }
    const j = await ask('result', {
      memo,
      ...(data.good && data.resultFeedback
        ? { previous: `${data.good}\n\n${data.improve}\n\n${data.action}`, feedback: data.resultFeedback } : {}),
    });
    if (j?.result) {
      upd({
        good: j.result.good || '', improve: j.result.improve || '',
        action: j.result.action || '', resultFeedback: '',
      });
    }
  }

  const docs = {
    all: buildSurveyDoc(data, basic || {}),
    result: buildResultDoc(data, basic || {}),
    form: buildFormDoc(data, basic || {}),
  };
  const [which, setWhich] = useState('result');

  async function saveHwpx(kind) {
    setBusy(true); setErr(''); setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const name = {
        all: `${center || '어린이집'}_${data.year}_부모만족도조사.hwpx`,
        result: `${center || '어린이집'}_${data.year}_부모만족도_결과보고서.hwpx`,
        form: `${center || '어린이집'}_${data.year}_부모만족도_설문지.hwpx`,
      }[kind];
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(docs[kind]), onProgress: setSaveMsg });
      downloadBlob(blob, name);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(false); }
  }

  function restart() {
    if (!window.confirm('부모만족도조사 서류에 작성한 내용을 모두 지우고 처음부터 다시 할까요?')) return;
    clearForm(KEY);
    setData(emptyData()); setMemo(''); go('size');
  }

  const sizeOk = Number(data.parents) > 0 && Number(data.copies) > 0 && Number(data.replies) > 0;

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 새로 만들 서류 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-bar"><span style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="wiz-count">{idx + 1} / {STEPS.length} 단계 · 부모만족도조사 (연 1회)</div>
        <h1>{STEP_TITLE[step]}</h1>
      </div>

      {/* ① 조사 규모 */}
      {step === 'size' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            <b>{center || '우리 어린이집'}</b>의 <b>{data.year}년</b> 부모만족도조사 서류를 만듭니다.<br />
            먼저 <b>몇 명에게 조사했는지</b> 알려주세요. 회신율이 자동으로 계산됩니다.
          </p>
          <p className="hint" style={{ color: '#b3620a' }}>
            ⚠️ 심사에서는 <b>설문지가 아니라 결과 기록</b>을 봅니다(별지 제8호 준용). 조사는 <b>전체 부모 대상 연 1회</b>이고,
            결과를 <b>전체 부모에게 안내</b>해야 10점을 받습니다.
          </p>

          <div className="field-row">
            <div className="field">
              <label>조사 연도</label>
              <input type="text" value={data.year} onChange={(e) => upd({ year: e.target.value })} />
            </div>
            <div className="field">
              <label>조사 시작일</label>
              <input type="date" value={data.from} onChange={(e) => upd({ from: e.target.value })} />
            </div>
            <div className="field">
              <label>조사 종료일</label>
              <input type="date" value={data.to} onChange={(e) => upd({ to: e.target.value })} />
            </div>
          </div>

          <h3 className="wiz-sub">조사 규모</h3>
          {kidCount > 0 && (
            <p className="hint">
              기본사항에 등록된 원아는 <b>{kidCount}명</b>입니다.
              <button type="button" className="ghost sm" style={{ marginLeft: 8 }}
                onClick={() => upd({ parents: String(kidCount), copies: String(kidCount), replies: String(Math.max(1, Math.round(kidCount * 0.9))) })}>
                이 인원으로 채우기 (회신율 90%)
              </button>
            </p>
          )}
          <div className="field-row">
            <div className="field">
              <label>부모 총 인원 (명)</label>
              <input type="text" inputMode="numeric" value={data.parents} placeholder="예) 24"
                onChange={(e) => upd({ parents: e.target.value })} />
            </div>
            <div className="field">
              <label>설문지 배부 (부)</label>
              <input type="text" inputMode="numeric" value={data.copies} placeholder="예) 23"
                onChange={(e) => upd({ copies: e.target.value })} />
            </div>
            <div className="field">
              <label>회신 (명)</label>
              <input type="text" inputMode="numeric" value={data.replies} placeholder="예) 22"
                onChange={(e) => upd({ replies: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>비고 (선택) — 형제자매·쌍둥이처럼 인원이 다른 이유가 있으면 적어주세요</label>
            <input type="text" value={data.twins} placeholder="예) 쌍둥이 2명 포함"
              onChange={(e) => upd({ twins: e.target.value })} />
          </div>
          {sizeOk && <p className="hint">→ <b>회신율 {replyRate(data)}%</b> 로 문서에 들어갑니다.</p>}

          <div className="field">
            <label>조사 방법 (한 줄에 하나씩)</label>
            <textarea rows={3} value={(data.ways || []).join('\n')}
              onChange={(e) => upd({ ways: e.target.value.split('\n') })} />
          </div>

          <button className="next-doc" disabled={!sizeOk} onClick={next}>설문지 만들기 →</button>
          {!sizeOk && <p className="hint center">※ 부모 총 인원 · 배부 · 회신 수를 넣어주세요.</p>}
        </div>
      )}

      {/* ② 설문지 */}
      {step === 'form' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              {data.year}년 설문지입니다. <b>영역 5개 · 문항 {AREAS.reduce((n, a) => n + QUESTIONS[a.key].length, 0)}개</b>와
              참여행사 수요조사가 들어 있습니다. 맨 앞 <b>인사말</b>만 우리 원에 맞게 다듬으면 됩니다.
            </p>
            <button className="primary" onClick={makeIntro} disabled={busy}>
              {busy ? 'AI가 작성 중입니다…' : `✍️ ${data.intro ? '다시 ' : ''}인사말 만들기`}
            </button>
            {err && <p className="error">⚠️ {err}</p>}
            {data.intro && (
              <>
                <div className="wiz-result">
                  <div className="wiz-result-top">설문지 인사말 <span>✏️ 직접 고쳐도 됩니다</span></div>
                  <textarea rows={6} value={data.intro} onChange={(e) => upd({ intro: e.target.value })} />
                </div>
                <div className="field">
                  <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                  <input type="text" value={data.introFeedback} onChange={(e) => upd({ introFeedback: e.target.value })} />
                </div>
                {data.introFeedback?.trim() && (
                  <button className="ghost" onClick={makeIntro} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                )}
              </>
            )}
            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="primary" onClick={next}>조사 결과 넣기 →</button>
            </div>
          </div>
          <div className="page-outer">
            <div className="print-area">
              <PrintSheet>{docs.form.map((b, i) => <Block key={i} b={b} />)}</PrintSheet>
            </div>
          </div>
        </>
      )}

      {/* ③ 결과 점수 */}
      {step === 'scores' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            영역별 <b>평균 점수</b>를 넣어주세요. (매우만족 5점 / 만족 4점 / 보통 3점 / 불만 2점 / 매우불만 1점)<br />
            아직 조사를 안 하셨다면 <b>샘플 점수</b>를 만들어 드립니다.
          </p>
          <div className="wiz-saves">
            <button className="primary" onClick={() => upd({ scores: makeSampleScores(data.replies, Number(data.year) || 0) })}>
              🎲 {data.year}년 샘플 점수 만들기
            </button>
            <button className="ghost" onClick={() => upd({ scores: {} })}>점수 지우기</button>
          </div>
          <p className="hint">※ 샘플은 회신 {data.replies || 0}명 기준으로 계산한 예시입니다. 실제 조사 결과가 있으면 그 값으로 고쳐 주세요.</p>

          <div className="score-grid">
            {AREAS.map((a) => (
              <div className="score-row" key={a.key}>
                <span className="score-name"><i style={{ background: a.color }} />{a.name}</span>
                <input type="number" step="0.1" min="1" max="5" value={data.scores?.[a.key] ?? ''}
                  placeholder="예) 4.5"
                  onChange={(e) => upd({ scores: { ...data.scores, [a.key]: e.target.value === '' ? '' : Number(e.target.value) } })} />
                <span className="score-unit">점</span>
              </div>
            ))}
          </div>
          {hasScores(data) && (
            <p className="hint">→ <b>전체 만족도 평균 {totalScore(data).toFixed(1)}점</b> ·
              가장 높은 영역 <b>{bestArea(data).name}</b> · 가장 낮은 영역 <b>{worstArea(data).name}</b></p>
          )}

          <div className="field">
            <label>부모님이 주신 의견·특이사항 (선택) — 적어주시면 개선 의견에 그대로 반영합니다</label>
            <textarea rows={5} value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder={'예) 급식에 백김치를 더 넣어달라는 의견\n생일잔치를 월별로 했으면 좋겠다는 의견'} />
          </div>

          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next} disabled={!hasScores(data)}>결과보고서 만들기 →</button>
          </div>
        </div>
      )}

      {/* ④ 결과보고서 */}
      {step === 'result' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              점수를 바탕으로 <b>잘된 점 · 개선 의견 · 조치사항</b>을 만들어 드립니다.
              결과보고서는 <b>그래프</b>와 함께 아래에 바로 보입니다.
            </p>
            <button className="primary" onClick={makeResult} disabled={busy}>
              {busy ? 'AI가 작성 중입니다…' : `✍️ ${data.good ? '다시 ' : ''}결과보고서 내용 만들기`}
            </button>
            {err && <p className="error">⚠️ {err}</p>}
            {data.good && (
              <>
                <div className="wiz-result">
                  <div className="wiz-result-top">잘된 점 <span>✏️ 한 줄에 하나씩</span></div>
                  <textarea rows={4} value={data.good} onChange={(e) => upd({ good: e.target.value })} />
                </div>
                <div className="wiz-result">
                  <div className="wiz-result-top">개선 의견 <span>✏️ 한 줄에 하나씩</span></div>
                  <textarea rows={5} value={data.improve} onChange={(e) => upd({ improve: e.target.value })} />
                </div>
                <div className="wiz-result">
                  <div className="wiz-result-top">어린이집 조치사항 <span>✏️ 한 줄에 하나씩</span></div>
                  <textarea rows={5} value={data.action} onChange={(e) => upd({ action: e.target.value })} />
                </div>
                <div className="field">
                  <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                  <input type="text" value={data.resultFeedback} onChange={(e) => upd({ resultFeedback: e.target.value })} />
                </div>
                {data.resultFeedback?.trim() && (
                  <button className="ghost" onClick={makeResult} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                )}
              </>
            )}
            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="primary" onClick={next}>저장하기 →</button>
            </div>
          </div>
          <div className="page-outer">
            <div className="print-area">
              <PrintSheet>{docs.result.map((b, i) => <Block key={i} b={b} />)}</PrintSheet>
            </div>
          </div>
        </>
      )}

      {/* ⑤ 저장 */}
      {step === 'save' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">무엇을 저장할지 고르세요. <b>심사 제출은 결과보고서</b>입니다.</p>
            <div className="range-row">
              {[['result', '결과보고서 (제출용)'], ['form', '설문지'], ['all', '결과보고서 + 설문지']].map(([k, label]) => (
                <button key={k} className={`range-chip ${which === k ? 'on' : ''}`} onClick={() => setWhich(k)}>{label}</button>
              ))}
            </div>
            <div className="wiz-saves">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장</button>
              <button className="ghost" onClick={() => saveHwpx(which)} disabled={busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            {err && <p className="error">⚠️ {err}</p>}
            <p className="hint">
              PDF는 인쇄 대화상자에서 <b>대상을 PDF로 저장</b>으로 고르시면 됩니다.<br />
              한글 파일에는 <b>글자와 표만</b> 들어갑니다. 그래프는 PDF를 쓰세요.
            </p>
            <p className="hint" style={{ color: '#b3620a' }}>
              ※ 결과보고서는 <b>전체 부모에게 안내</b>해야 합니다. 인쇄해서 나눠 드리거나 키즈노트·밴드에 올려 주세요.
            </p>
            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
            </div>
            <button className="next-doc" onClick={onBack}>📋 목차로 이동 · 다음 문서 만들기 →</button>
          </div>
          <div className="page-outer">
            <div className="print-area">
              <PrintSheet>{docs[which].map((b, i) => <Block key={i} b={b} />)}</PrintSheet>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
