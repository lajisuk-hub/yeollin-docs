'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import { fileToResizedDataURL } from '../lib/image';
import {
  MONTH_SEQ, QUARTERS, AGE_OPTIONS, TARGET_OPTIONS,
  DEFAULT_NOTICE_BG, DEFAULT_TOP, DEFAULT_BOTTOM,
  emptyData, emptyMonth, monthList, monthLabel, monthOf, planOf, defaultPlan, defaultMemo,
  whenText, attendText, totalCount, flowList,
  monthHasContent, monthDone, noticeDone, chosenMonths, noticeBlock, upgradeMonth,
  buildProgramDoc, buildOneMonthDoc, toHwpxBlocks,
} from '../lib/programDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'program-wizard';
const MAX_PHOTOS = 4;

// 한 달 안에서 지나가는 단계
const STEPS = ['notice', 'record', 'done'];
const STEP_TITLE = {
  notice: '이 달 공지문 만들기',
  record: '실시기록(결과보고서) 만들기',
  done: '이 달 정리본',
};

export default function ProgramWizard({ onBack }) {
  const [data, setData] = useState(emptyData());
  const [basic, setBasic] = useState(null);
  // view: {v:'basic'} | {v:'plan'} | {v:'pick'} | {v:'step', q, s} | {v:'finish'} | {v:'save'}
  const [view, setView] = useState({ v: 'basic' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const loadedRef = useRef(false);
  const timer = useRef(null);

  // ── 불러오기 / 자동 저장 ──
  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info')]).then(([saved, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (saved?.plan) {
        // 예전에 저장한 달은 서식 기본값(아래 여백 등)이 옛 값일 수 있어 새 값으로 올려 준다
        const months = Object.fromEntries(Object.entries(saved.months || {}).map(([k, v]) => [k, upgradeMonth(v)]));
        setData({ ...emptyData(), ...saved, months });
        if (saved.view) setView(saved.view);
      }
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveForm(KEY, { ...data, view }); }, 600);
    return () => clearTimeout(timer.current);
  }, [data, view]);

  const center = basic?.centerName?.trim() || '';
  const months = monthList(data.year);
  const q = view.q ?? 0;
  const mi = months[q] || months[0];
  const cur = monthOf(data, mi.key);
  const curPlan = planOf(data, mi.m);

  const upd = (patch) => setData((d) => ({
    ...d,
    months: { ...d.months, [mi.key]: { ...emptyMonth(), ...(d.months?.[mi.key] || {}), ...patch } },
  }));
  const setPlanRow = (m, patch) => setData((d) => ({
    ...d,
    plan: (d.plan || []).map((p) => (p.m === m ? { ...p, ...patch } : p)),
  }));

  // 실시기록 화면에 들어오면 공지문에 적은 시간·주제·장소로 메모 샘플을 미리 채워 준다 (비어 있을 때만)
  useEffect(() => {
    if (!loadedRef.current || view.v !== 'step' || view.s !== 'record') return;
    const x = data.months?.[mi.key];
    if (!x?.memo?.trim()) upd({ memo: defaultMemo(x || {}, curPlan) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.v, view.s, q]);

  const go = (v) => { setErr(''); setView(v); window.scrollTo(0, 0); };
  const stepIdx = STEPS.indexOf(view.s);
  const goStep = (s) => go({ v: 'step', q, s });
  const next = () => goStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)]);
  const prev = () => (stepIdx <= 0 ? go({ v: 'pick' }) : goStep(STEPS[stepIdx - 1]));

  const agesText = (data.ages || []).join(', ');
  const targetsText = [...(data.targets || []).filter((t) => t !== '기타'), data.targetEtc].filter(Boolean).join(', ');

  // ── AI 부르기 ──
  async function ask(kind, extra = {}) {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          center,
          year: data.year,
          ages: agesText,
          targets: targetsText,
          past: data.past,
          sample: data.samples?.[kind] || '',
          ...extra,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      return j;
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
      return null;
    } finally {
      setBusy(false);
    }
  }

  // 지금까지 한 프로그램이 없을 때 임의 추천
  async function makeSuggest() {
    const j = await ask('suggest');
    if (j?.text) setData((d) => ({ ...d, past: j.text }));
  }

  // 연간계획 12개월
  async function makePlan() {
    const j = await ask('plan', data.plan?.length && data.planFeedback
      ? {
        previous: data.plan.map((p) => `${p.m}월 | ${p.theme} | ${p.target} | ${p.method} | ${p.content}`).join('\n'),
        feedback: data.planFeedback,
      } : {});
    if (j?.result?.months) {
      const got = j.result.months;
      const plan = MONTH_SEQ.map((m, i) => {
        const x = got.find((y) => Number(y.m) === m) || got[i] || {};
        return { m, theme: x.theme || '', target: x.target || '', method: x.method || '', content: x.content || '' };
      });
      setData((d) => ({ ...d, plan, planFeedback: '' }));
    }
  }

  // 그 달 공지문
  async function makeNotice() {
    const j = await ask('notice', {
      month: mi.label,
      program: curPlan.theme,
      content: curPlan.content,
      when: whenText(cur),
      place: cur.place,
      target: cur.target || curPlan.target,
      ...(cur.noticeGreeting && cur.noticeFeedback
        ? { previous: `${cur.noticeGreeting}\n\n${(cur.noticeNotes || []).join('\n')}`, feedback: cur.noticeFeedback } : {}),
    });
    if (j?.result) {
      upd({
        noticeGreeting: j.result.greeting || '',
        noticeNotes: Array.isArray(j.result.notes) ? j.result.notes : [],
        noticeFeedback: '',
      });
    }
  }

  // 그 달 실시기록
  async function makeRecord() {
    if (!cur.memo?.trim()) { setErr('그날 어떻게 진행했는지 먼저 적어주세요.'); return; }
    const prevText = flowList(cur).map((x) => `${x.time} ${x.content}`).join('\n');
    const j = await ask('record', {
      month: mi.label,
      program: curPlan.theme,
      content: curPlan.content,
      when: whenText(cur),
      place: cur.place,
      target: cur.target || curPlan.target,
      attend: attendText(cur) ? `${attendText(cur)} (계 ${totalCount(cur)}명)` : '',
      memo: cur.memo,
      ...(prevText && cur.recordFeedback
        ? { previous: `${prevText}\n\n${cur.summary}`, feedback: cur.recordFeedback } : {}),
    });
    if (j?.result) {
      upd({
        flow: Array.isArray(j.result.flow) ? j.result.flow : [],
        summary: j.result.summary || '',
        recordFeedback: '',
      });
    }
  }

  // 공지문을 토대로 그날 메모 초안 만들기
  async function makeMemo() {
    const j = await ask('memo', {
      month: mi.label,
      program: curPlan.theme,
      content: curPlan.content,
      when: whenText(cur),
      place: cur.place,
      target: cur.target || curPlan.target,
      notice: [cur.noticeGreeting, ...(cur.noticeNotes || [])].filter(Boolean).join('\n'),
    });
    if (j?.text) upd({ memo: j.text });
  }

  async function makeReview() {
    const j = await ask('review', {
      month: mi.label, program: curPlan.theme, memo: cur.memo,
      attend: attendText(cur),
      ...(cur.review && cur.reviewFeedback ? { previous: cur.review, feedback: cur.reviewFeedback } : {}),
    });
    if (j?.text) upd({ review: j.text, reviewFeedback: '' });
  }

  // 최종 문서 맨 앞 필요성
  async function makeNeed() {
    const j = await ask('need', data.need && data.needFeedback
      ? { previous: data.need, feedback: data.needFeedback } : {});
    if (j?.text) setData((d) => ({ ...d, need: j.text, needFeedback: '' }));
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    setErr('');
    try {
      const room = MAX_PHOTOS - (cur.photos?.length || 0);
      const urls = await Promise.all(files.slice(0, room).map((f) => fileToResizedDataURL(f)));
      upd({ photos: [...(cur.photos || []), ...urls] });
    } catch {
      setErr('사진을 불러오지 못했습니다. 다른 사진으로 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  // 공지문 서식 그림 올리기
  async function pickBg(file) {
    if (!file) return;
    setBusy(true);
    try { upd({ bg: await fileToResizedDataURL(file, 1400) }); }
    catch { setErr('그림을 불러오지 못했습니다.'); }
    finally { setBusy(false); }
  }

  const blocks = buildProgramDoc(data, basic || {});
  const picks = chosenMonths(data);

  // 한글(hwpx) 저장 — 전체 문서 또는 한 달만
  async function saveHwpx(only = null) {
    setBusy(true);
    setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const src = only === null ? blocks : buildOneMonthDoc(data, only, basic || {});
      const name = only === null
        ? `${center || '어린이집'}_부모참여프로그램.hwpx`
        : `${center || '어린이집'}_부모참여프로그램_${only.label.replace(/\s/g, '')}.hwpx`;
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(src), onProgress: setSaveMsg });
      downloadBlob(blob, name);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    if (!window.confirm('부모참여프로그램 서류에 작성한 내용을 모두 지우고 처음부터 다시 할까요?')) return;
    clearForm(KEY);
    setData(emptyData());
    go({ v: 'basic' });
  }

  const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const doneCount = months.filter((x) => monthHasContent(data.months?.[x.key])).length;

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 새로 만들 서류 목록으로</button>

      {/* ───────── 1. 기본사항 ───────── */}
      {view.v === 'basic' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 · 1단계</div>
            <h1>기본사항 알려주기</h1>
          </div>

          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>{center || '우리 어린이집'}</b>의 부모참여프로그램 서류를 만듭니다.<br />
              세 가지만 알려주시면 <b>{data.year}년 연간계획(월 1회)</b>부터 만들어 드립니다.
            </p>
            <ul className="wiz-steps">
              <li><b>기본사항</b> — 아이 연령 · 지금까지 한 프로그램 · 희망하는 참여 대상</li>
              <li><b>연간계획</b> — 3월부터 다음 해 2월까지 월 1회로 계획, 보고 고치기</li>
              <li><b>달마다</b> — 공지문 → 실시기록(결과보고서) → 사진</li>
              <li><b>마무리</b> — 분기별 1회만 낼지, 월 1회 전부 낼지 고르기</li>
            </ul>
            <p className="hint">중간에 창을 닫아도 <b>여기까지 한 내용은 저장</b>됩니다.</p>
            {!center && <p className="error">⚠️ 기본사항에 어린이집 이름이 없습니다. 먼저 등록하시면 문서에 자동으로 들어갑니다.</p>}
          </div>

          <div className="card wiz-card">
            <h2 className="wiz-sub">① 우리 어린이집 아이 연령</h2>
            <p className="hint">있는 연령을 모두 골라주세요. 연령에 맞는 활동으로 계획을 세웁니다.</p>
            <div className="chk-list">
              {AGE_OPTIONS.map((a) => {
                const on = (data.ages || []).includes(a);
                return (
                  <label key={a} className={`chk ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => setData((d) => ({ ...d, ages: toggle(d.ages || [], a) }))} />
                    <span>{a}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="card wiz-card">
            <h2 className="wiz-sub">② 지금까지 해 온 부모참여프로그램</h2>
            <p className="hint">기억나는 대로 한 줄에 하나씩 적어주세요. <b>없으면 아래 버튼</b>을 누르시면 우리 원에 맞게 추천해 드립니다.</p>
            <div className="field">
              <textarea rows={7} value={data.past} placeholder={'예) 5월 어버이날 감사 행사\n7월 여름 물놀이\n12월 성탄 잔치'}
                onChange={(e) => setData((d) => ({ ...d, past: e.target.value }))} />
            </div>
            <button className="ghost" onClick={makeSuggest} disabled={busy}>
              {busy ? 'AI가 추천 중입니다…' : '💡 해 본 것이 없어요 · 추천받기'}
            </button>
            {err && <p className="error">⚠️ {err}</p>}
          </div>

          <div className="card wiz-card">
            <h2 className="wiz-sub">③ 앞으로 희망하는 참여 대상</h2>
            <p className="hint">고른 대상이 열두 달에 골고루 나뉘어 계획됩니다.</p>
            <div className="chk-list">
              {TARGET_OPTIONS.map((t) => {
                const on = (data.targets || []).includes(t);
                return (
                  <label key={t} className={`chk ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => setData((d) => ({ ...d, targets: toggle(d.targets || [], t) }))} />
                    <span>{t}</span>
                  </label>
                );
              })}
            </div>
            {(data.targets || []).includes('기타') && (
              <div className="field">
                <label>기타 — 어떤 분들인가요?</label>
                <input type="text" value={data.targetEtc} placeholder="예) 형제자매, 이웃 어르신"
                  onChange={(e) => setData((d) => ({ ...d, targetEtc: e.target.value }))} />
              </div>
            )}
            <div className="field">
              <label>연간계획 시작 연도 (어린이집 학년도 기준 3월 시작)</label>
              <input type="text" value={data.year} style={{ maxWidth: 160 }}
                onChange={(e) => setData((d) => ({ ...d, year: e.target.value }))} />
            </div>
            <button className="next-doc" disabled={!(data.ages || []).length || !(data.targets || []).length}
              onClick={() => go({ v: 'plan' })}>
              연간계획 만들기 →
            </button>
            {(!(data.ages || []).length || !(data.targets || []).length) && (
              <p className="hint center">※ 아이 연령과 희망 대상을 하나 이상 골라주세요.</p>
            )}
          </div>
        </>
      )}

      {/* ───────── 2. 연간계획 ───────── */}
      {view.v === 'plan' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 · 2단계</div>
            <h1>{data.year}년 연간계획 (월 1회)</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'basic' })}>← 기본사항 고치기</button>

          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>{data.year}년 3월부터 {Number(data.year) + 1}년 2월까지</b> 열두 달을 <b>월 1회</b>로 계획합니다.<br />
              AI가 만들어 드리면 <b>표에서 바로 고치실 수 있습니다.</b>
            </p>
            <p className="hint" style={{ color: '#b3620a' }}>
              ⚠️ 심사에서 가장 많이 놓치는 부분입니다. <b>연간계획 없이 실시기록만</b> 있으면 5점이 아니라 <b>2점</b>만 인정됩니다.
            </p>
            <div className="wiz-saves">
              <button className="primary" onClick={makePlan} disabled={busy}>
                {busy ? 'AI가 계획을 세우는 중입니다…' : `✍️ ${data.plan?.length ? '다시 ' : ''}연간계획 만들기`}
              </button>
              <button className="ghost" onClick={() => setData((d) => ({ ...d, plan: defaultPlan(d.year, d.targets) }))}>
                📋 기본 계획표 넣기 (AI 없이)
              </button>
            </div>
            {err && <p className="error">⚠️ {err}</p>}
          </div>

          {!!data.plan?.length && (
            <div className="card wiz-card">
              <h2 className="wiz-sub">연간계획표 <span className="edit-badge">✏️ 칸을 눌러 바로 고치세요</span></h2>
              <div className="plan-head">
                <span>시기</span><span>주제(프로그램명)</span><span>대상</span><span>운영 방법</span><span>주요 내용</span>
              </div>
              {data.plan.map((p) => (
                <div className="plan-row" key={p.m}>
                  <span className="plan-m">{monthLabel(data.year, p.m)}</span>
                  <input type="text" value={p.theme} placeholder="주제" onChange={(e) => setPlanRow(p.m, { theme: e.target.value })} />
                  <input type="text" value={p.target} placeholder="대상" onChange={(e) => setPlanRow(p.m, { target: e.target.value })} />
                  <input type="text" value={p.method} placeholder="운영 방법" onChange={(e) => setPlanRow(p.m, { method: e.target.value })} />
                  <input type="text" value={p.content} placeholder="주요 내용" onChange={(e) => setPlanRow(p.m, { content: e.target.value })} />
                </div>
              ))}
              <div className="field">
                <label>계획을 통째로 고치고 싶으면 알려주세요 (선택)</label>
                <input type="text" value={data.planFeedback} onChange={(e) => setData((d) => ({ ...d, planFeedback: e.target.value }))}
                  placeholder="예) 아빠 참여를 더 늘리고, 여름에는 야외활동을 넣어주세요" />
              </div>
              {data.planFeedback?.trim() && (
                <button className="ghost" onClick={makePlan} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
              )}
              <button className="next-doc" onClick={() => go({ v: 'pick' })}>달마다 공지문·기록 만들기 →</button>
            </div>
          )}
        </>
      )}

      {/* ───────── 3. 달 고르기 ───────── */}
      {view.v === 'pick' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 · 3단계</div>
            <h1>달마다 자료 만들기</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'plan' })}>← 연간계획 고치기</button>

          <div className="card wiz-card">
            <p className="wiz-lead">
              달을 골라 <b>공지문 → 실시기록</b> 순서로 만듭니다. <b>3월부터</b> 차례로 하시면 됩니다.<br />
              열두 달을 다 하지 않아도 됩니다. 마지막에 <b>분기별 1회만 낼지</b> 고르실 수 있습니다.
            </p>
            <div className="q-grid month">
              {months.map((x, i) => {
                const m = data.months?.[x.key];
                const done = monthDone(m);
                const some = monthHasContent(m);
                const p = planOf(data, x.m);
                return (
                  <button key={x.key} className={`q-card ${done ? 'done' : ''}`} onClick={() => go({ v: 'step', q: i, s: 'notice' })}>
                    <div className="q-top">
                      <b>{x.label}</b>
                      <span className={`q-chip ${done ? 'ok' : ''}`}>{done ? '완성' : some ? '작성 중' : '아직'}</span>
                    </div>
                    <div className="q-when">{p.theme || '주제 미정'}</div>
                    {m?.date && <div className="q-date">{whenText(m)}</div>}
                  </button>
                );
              })}
            </div>
            <p className="hint">{doneCount}/12 달을 작성했습니다.</p>
            <button className="next-doc" onClick={() => go({ v: 'finish' })}>
              ✅ 이만하면 됐어요 · 문서 정리하기 →
            </button>
            <div className="wiz-nav">
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
            </div>
          </div>
        </>
      )}

      {/* ───────── 달별 단계 ───────── */}
      {view.v === 'step' && (
        <>
          <div className="wiz-head">
            <div className="wiz-bar"><span style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} /></div>
            <div className="wiz-count">{stepIdx + 1} / {STEPS.length} 단계 · {mi.label} ({mi.quarter})</div>
            <h1>{STEP_TITLE[view.s]}</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'pick' })}>← 달 목록으로</button>

          {/* 공지문 */}
          {view.s === 'notice' && (
            <>
              <div className="card wiz-card">
                <p className="wiz-lead">
                  <b>{mi.label} · {curPlan.theme || '주제 미정'}</b><br />
                  연간계획의 이 달 주제로 <b>부모님께 보낼 공지문</b>을 만듭니다. 먼저 <b>언제·어디서</b>만 정해 주세요.
                </p>
                <div className="field-row">
                  <div className="field">
                    <label>운영 날짜</label>
                    <input type="date" value={cur.date} onChange={(e) => upd({ date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>운영 시간</label>
                    <input type="text" value={cur.time} placeholder="예) 오전 10:00 ~ 11:30"
                      onChange={(e) => upd({ time: e.target.value })} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>장소</label>
                    <input type="text" value={cur.place} placeholder="예) 어린이집 유희실"
                      onChange={(e) => upd({ place: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>대상</label>
                    <input type="text" value={cur.target} placeholder={curPlan.target || '예) 아빠와 아이'}
                      onChange={(e) => upd({ target: e.target.value })} />
                  </div>
                </div>

                <Sample label="가지고 계신 공지문 서식이 있으면 붙여넣어 주세요 (선택 · 한 번만 넣으면 모든 달에 이 틀로 만듭니다)"
                  value={data.samples.notice} onChange={(v) => setData((d) => ({ ...d, samples: { ...d.samples, notice: v } }))} />
                <button className="primary" onClick={makeNotice} disabled={busy || !cur.date}>
                  {busy ? 'AI가 작성 중입니다…' : `✍️ ${cur.noticeGreeting ? '다시 ' : ''}공지문 만들기`}
                </button>
                {!cur.date && <p className="hint">※ 운영 날짜를 먼저 넣어주세요.</p>}
                {err && <p className="error">⚠️ {err}</p>}

                {cur.noticeGreeting && (
                  <>
                    <div className="wiz-result">
                      <div className="wiz-result-top">공지문 본문 <span>✏️ 직접 고쳐도 됩니다</span></div>
                      <textarea rows={8} value={cur.noticeGreeting} onChange={(e) => upd({ noticeGreeting: e.target.value })} />
                    </div>
                    <div className="wiz-result">
                      <div className="wiz-result-top">참고사항 <span>✏️ 한 줄에 하나씩</span></div>
                      <textarea rows={4} value={(cur.noticeNotes || []).join('\n')}
                        onChange={(e) => upd({ noticeNotes: e.target.value.split('\n') })} />
                    </div>
                    <div className="field">
                      <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                      <input type="text" value={cur.noticeFeedback} onChange={(e) => upd({ noticeFeedback: e.target.value })}
                        placeholder="예) 아버지도 꼭 오시면 좋겠다는 말을 넣어주세요" />
                    </div>
                    {cur.noticeFeedback?.trim() && (
                      <button className="ghost" onClick={makeNotice} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                    )}
                  </>
                )}
              </div>

              {cur.noticeGreeting && (
                <div className="card wiz-card">
                  <h3 className="card-title">이렇게 나옵니다 — 그대로 인쇄해서 나눠주세요</h3>
                  <div className="bg-tools">
                    <div className="bg-row">
                      <span className="bg-label">서식 그림</span>
                      <label className="file-btn sm">
                        🖼️ 내 그림 올리기
                        <input type="file" accept="image/*" hidden onChange={(e) => { pickBg(e.target.files[0]); e.target.value = ''; }} />
                      </label>
                      <button className="bg-btn" onClick={() => upd({ bg: DEFAULT_NOTICE_BG, top: DEFAULT_TOP, bottom: DEFAULT_BOTTOM })}>기본 서식</button>
                      <button className="bg-btn" onClick={() => upd({ bg: '' })}>그림 없이</button>
                    </div>
                    {cur.bg && (
                      <div className="bg-row sliders">
                        <label>글 시작 위치
                          <input type="range" min="20" max="60" value={cur.top ?? DEFAULT_TOP}
                            onChange={(e) => upd({ top: Number(e.target.value) })} />
                          <b>{cur.top ?? DEFAULT_TOP}%</b>
                        </label>
                        <label>아래 여백
                          <input type="range" min="8" max="35" value={cur.bottom ?? DEFAULT_BOTTOM}
                            onChange={(e) => upd({ bottom: Number(e.target.value) })} />
                          <b>{cur.bottom ?? DEFAULT_BOTTOM}%</b>
                        </label>
                        <label>글자 크기
                          <input type="range" min="70" max="200" value={Math.round((cur.textScale ?? 1.15) * 100)}
                            onChange={(e) => upd({ textScale: Number(e.target.value) / 100 })} />
                          <b>{Math.round((cur.textScale ?? 1.15) * 100)}%</b>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="page-outer">
                    <div className="print-area">
                      <PrintSheet>
                        <Block b={noticeBlock(data, mi, center)} />
                      </PrintSheet>
                    </div>
                  </div>
                </div>
              )}

              <div className="card wiz-card">
                <div className="wiz-nav">
                  <button className="ghost" onClick={() => go({ v: 'pick' })}>← 달 목록</button>
                  <button className="primary" onClick={next} disabled={!noticeDone(cur)}>실시기록 만들기 →</button>
                </div>
              </div>
            </>
          )}

          {/* 실시기록 */}
          {view.s === 'record' && (
            <div className="card wiz-card">
              <p className="wiz-lead">
                <b>{mi.label} · {curPlan.theme || ''}</b>을(를) 실제로 어떻게 했는지 적어주세요.<br />
                <b>운영일시 · 참석자 · 운영내용</b>은 심사에서 반드시 확인하는 세 가지입니다.
              </p>

              <h3 className="wiz-sub">참석 인원</h3>
              <div className="field-row">
                <div className="field">
                  <label>부모 (명)</label>
                  <input type="text" inputMode="numeric" value={cur.parents} placeholder="예) 28"
                    onChange={(e) => upd({ parents: e.target.value })} />
                </div>
                <div className="field">
                  <label>영유아 (명)</label>
                  <input type="text" inputMode="numeric" value={cur.kids} placeholder="예) 30"
                    onChange={(e) => upd({ kids: e.target.value })} />
                </div>
                <div className="field">
                  <label>교직원 (명)</label>
                  <input type="text" inputMode="numeric" value={cur.staff} placeholder="예) 7"
                    onChange={(e) => upd({ staff: e.target.value })} />
                </div>
              </div>
              {totalCount(cur) > 0 && <p className="hint">→ 참석 현황 : <b>{attendText(cur)} (계 {totalCount(cur)}명)</b></p>}

              <Sample label="가지고 계신 실시기록 서식이 있으면 붙여넣어 주세요 (선택)"
                value={data.samples.record} onChange={(v) => setData((d) => ({ ...d, samples: { ...d.samples, record: v } }))} />
              <div className="field">
                <label>그날 어떻게 진행했는지 메모 <span className="edit-badge">✏️ 공지문을 토대로 샘플을 넣어두었습니다 · 우리 원 이야기로 고쳐 주세요</span></label>
                <textarea rows={11} value={cur.memo}
                  placeholder={'예) 10시 부모님 오심, 이름표 달기\n10시 20분 반별 놀이 활동\n11시 소감 나누기\n아빠들이 많이 오셔서 아이들이 좋아함'}
                  onChange={(e) => upd({ memo: e.target.value })} />
                <div className="wiz-saves" style={{ marginTop: 8 }}>
                  <button type="button" className="ghost sm" onClick={() => upd({ memo: defaultMemo(cur, curPlan) })}>
                    📋 샘플 다시 넣기
                  </button>
                  <button type="button" className="ghost sm" onClick={makeMemo} disabled={busy}>
                    {busy ? 'AI가 작성 중입니다…' : '✍️ 공지문을 토대로 AI가 자세히 써주기'}
                  </button>
                </div>
              </div>
              <button className="primary" onClick={makeRecord} disabled={busy}>
                {busy ? 'AI가 정리 중입니다…' : `✍️ ${flowList(cur).length ? '다시 ' : ''}실시기록으로 정리하기`}
              </button>
              {err && <p className="error">⚠️ {err}</p>}

              {!!flowList(cur).length && (
                <>
                  <div className="wiz-result">
                    <div className="wiz-result-top">진행 순서 <span>✏️ 직접 고쳐도 됩니다</span></div>
                    {cur.flow.map((x, n) => (
                      <div className="flow-row" key={n}>
                        <input type="text" className="flow-time" value={x.time || ''} placeholder="시간"
                          onChange={(e) => upd({ flow: cur.flow.map((y, i) => (i === n ? { ...y, time: e.target.value } : y)) })} />
                        <textarea rows={2} value={x.content || ''}
                          onChange={(e) => upd({ flow: cur.flow.map((y, i) => (i === n ? { ...y, content: e.target.value } : y)) })} />
                        <button type="button" className="mem-del"
                          onClick={() => upd({ flow: cur.flow.filter((_, i) => i !== n) })}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="ghost sm"
                      onClick={() => upd({ flow: [...cur.flow, { time: '', content: '' }] })}>＋ 줄 추가</button>
                  </div>
                  <div className="wiz-result">
                    <div className="wiz-result-top">운영 내용 정리 <span>✏️ 직접 고쳐도 됩니다</span></div>
                    <textarea rows={8} value={cur.summary} onChange={(e) => upd({ summary: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                    <input type="text" value={cur.recordFeedback} onChange={(e) => upd({ recordFeedback: e.target.value })}
                      placeholder="예) 놀이 활동을 더 자세히 써주세요" />
                  </div>
                  {cur.recordFeedback?.trim() && (
                    <button className="ghost" onClick={makeRecord} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                  )}

                  <h3 className="wiz-sub">운영 평가 (선택)</h3>
                  <p className="hint">부모 의견과 다음에 보완할 점을 덧붙이면 더 좋은 기록이 됩니다.</p>
                  <button className="ghost" onClick={makeReview} disabled={busy}>
                    {busy ? 'AI가 작성 중입니다…' : `✍️ ${cur.review ? '다시 ' : ''}운영 평가 쓰기`}
                  </button>
                  {cur.review && (
                    <div className="wiz-result">
                      <div className="wiz-result-top">운영 평가 및 개선사항 <span>✏️ 직접 고쳐도 됩니다</span></div>
                      <textarea rows={6} value={cur.review} onChange={(e) => upd({ review: e.target.value })} />
                    </div>
                  )}
                </>
              )}

              <h3 className="wiz-sub">활동 사진 (없으면 넘어가셔도 됩니다)</h3>
              <div className="img-grid">
                {(cur.photos || []).map((src, i) => (
                  <div className="img-thumb sm" key={i}>
                    <img src={src} alt="" />
                    <button type="button" className="img-del" onClick={() => upd({ photos: cur.photos.filter((_, x) => x !== i) })}>✕</button>
                  </div>
                ))}
                {(cur.photos?.length || 0) < MAX_PHOTOS && (
                  <label className={`img-upload sm ${busy ? 'busy' : ''}`}>
                    {busy ? '불러오는 중…' : '＋ 사진 추가'}
                    <input type="file" accept="image/*" multiple hidden disabled={busy}
                      onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                  </label>
                )}
              </div>

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next} disabled={!flowList(cur).length}>{mi.label} 정리본 보기 →</button>
              </div>
            </div>
          )}

          {/* 이 달 정리본 */}
          {view.s === 'done' && (
            <>
              <div className="card wiz-card">
                <p className="wiz-lead">
                  <b>{mi.label} 정리본</b>입니다. <b>공지문 + 결과보고서</b>가 한 세트로 들어 있습니다.
                </p>
                <div className="wiz-saves">
                  <button className="primary" onClick={() => window.print()}>🖨️ {mi.label}만 PDF로 저장</button>
                  <button className="ghost" onClick={() => saveHwpx(mi)} disabled={busy}>📄 {mi.label}만 한글(hwpx)로 저장</button>
                </div>
                {saveMsg && <p className="hint">{saveMsg}</p>}
                {err && <p className="error">⚠️ {err}</p>}

                {q < months.length - 1 ? (
                  <button className="next-doc" onClick={() => go({ v: 'step', q: q + 1, s: 'notice' })}>
                    ✅ 확인했습니다 · {months[q + 1].label} 이어서 만들기 →
                  </button>
                ) : (
                  <button className="next-doc" onClick={() => go({ v: 'finish' })}>
                    ✅ 열두 달 끝 · 문서 정리하기 →
                  </button>
                )}
                <div className="wiz-nav">
                  <button className="ghost" onClick={prev}>← 이전</button>
                  <button className="ghost" onClick={() => go({ v: 'pick' })}>달 목록으로</button>
                  <button className="ghost" onClick={() => go({ v: 'finish' })}>문서 정리하기</button>
                </div>
              </div>
              <div className="page-outer">
                <div className="print-area">
                  <PrintSheet>
                    {buildOneMonthDoc(data, mi, basic || {}).map((b, i) => <Block key={i} b={b} />)}
                  </PrintSheet>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ───────── 4. 마무리 — 몇 회로 낼지 고르기 ───────── */}
      {view.v === 'finish' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 · 마무리</div>
            <h1>문서 정리하기</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'pick' })}>← 달 목록으로</button>

          <div className="card wiz-card">
            <h2 className="wiz-sub">① 부모참여프로그램의 필요성</h2>
            <p className="hint">최종 문서 <b>맨 앞</b>에 들어갑니다. 비워 두면 기본 문구가 들어갑니다.</p>
            <button className="primary" onClick={makeNeed} disabled={busy}>
              {busy ? 'AI가 작성 중입니다…' : `✍️ ${data.need ? '다시 ' : ''}필요성 쓰기`}
            </button>
            {err && <p className="error">⚠️ {err}</p>}
            {data.need && (
              <>
                <div className="wiz-result">
                  <div className="wiz-result-top">부모참여프로그램의 필요성 <span>✏️ 직접 고쳐도 됩니다</span></div>
                  <textarea rows={8} value={data.need} onChange={(e) => setData((d) => ({ ...d, need: e.target.value }))} />
                </div>
                <div className="field">
                  <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                  <input type="text" value={data.needFeedback} onChange={(e) => setData((d) => ({ ...d, needFeedback: e.target.value }))} />
                </div>
                {data.needFeedback?.trim() && (
                  <button className="ghost" onClick={makeNeed} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                )}
              </>
            )}
          </div>

          <div className="card wiz-card">
            <h2 className="wiz-sub">② 몇 회분으로 제출할까요?</h2>
            <p className="wiz-lead">
              열린어린이집 심사는 <b>분기별 1회 자료면 충족</b>됩니다.
              계획은 월 1회로 세웠지만, 제출 문서는 <b>분기마다 1회씩(4회)</b>만 넣을 수도 있습니다.
            </p>
            <div className="mode-grid">
              <button className={`mode-card ${data.mode === 'quarter' ? 'on' : ''}`}
                onClick={() => setData((d) => ({ ...d, mode: 'quarter' }))}>
                <b>분기별 1회 (4회)</b>
                <span>심사 기준에 딱 맞게 · 문서가 짧고 준비가 쉽습니다</span>
              </button>
              <button className={`mode-card ${data.mode === 'month' ? 'on' : ''}`}
                onClick={() => setData((d) => ({ ...d, mode: 'month' }))}>
                <b>월 1회 전부</b>
                <span>지금까지 만든 달을 모두 넣습니다 · 운영을 충실히 보여줍니다</span>
              </button>
            </div>

            {data.mode === 'quarter' && (
              <>
                <h3 className="wiz-sub">분기마다 넣을 달을 하나씩 골라주세요</h3>
                {QUARTERS.map((qq) => (
                  <div className="pick-q" key={qq.no}>
                    <span className="pick-q-name">{qq.no}</span>
                    <div className="pick-q-months">
                      {qq.months.map((m) => {
                        const x = months.find((y) => y.m === m);
                        const has = monthHasContent(data.months?.[x.key]);
                        const on = (data.picked || []).includes(x.key);
                        return (
                          <button key={x.key} className={`pick-m ${on ? 'on' : ''} ${has ? 'has' : ''}`}
                            onClick={() => setData((d) => {
                              const others = (d.picked || []).filter((k) => !qq.months.some((mm) => months.find((y) => y.m === mm).key === k));
                              return { ...d, picked: on ? others : [...others, x.key] };
                            })}>
                            {x.label}
                            {has && <em>자료 있음</em>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="hint">
                  ※ 고른 달에 <b>공지문·실시기록이 아직 없으면</b> 문서가 비어 보입니다. 달 목록에서 먼저 만들어 주세요.
                </p>
              </>
            )}

            <button className="next-doc" disabled={!data.mode} onClick={() => go({ v: 'save' })}>
              📄 최종 문서 보기 · 저장하기 →
            </button>
            {!data.mode && <p className="hint center">※ 위에서 제출 방식을 골라주세요.</p>}
          </div>
        </>
      )}

      {/* ───────── 저장 ───────── */}
      {view.v === 'save' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">부모참여프로그램 · 문서 저장</div>
            <h1>문서 저장하기</h1>
          </div>
          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>필요성 → 연간계획 → 달마다 [공지문 + 결과보고서]</b> 순서로 묶었습니다.
              지금 문서에는 <b>{picks.length}개 달</b>이 들어 있습니다.
            </p>
            {!picks.length && (
              <p className="hint" style={{ color: '#b8860b' }}>
                ※ 아직 들어갈 달이 없습니다. 달 목록에서 공지문과 실시기록을 먼저 만들어 주세요.
              </p>
            )}
            <div className="wiz-saves">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (사진 포함)</button>
              <button className="ghost" onClick={() => saveHwpx()} disabled={busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            {err && <p className="error">⚠️ {err}</p>}
            <p className="hint">
              PDF는 인쇄 대화상자에서 <b>대상을 PDF로 저장</b>으로 고르시면 됩니다.<br />
              한글 파일에는 <b>글자만</b> 들어갑니다. 사진과 서식 그림은 PDF를 쓰시거나 한글에서 직접 붙여 넣어 주세요.
            </p>
            <div className="wiz-nav">
              <button className="ghost" onClick={() => go({ v: 'finish' })}>← 제출 방식 다시 고르기</button>
              <button className="ghost" onClick={() => go({ v: 'pick' })}>달 목록으로</button>
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
            </div>
            <button className="next-doc" onClick={onBack}>📋 목차로 이동 · 다음 문서 만들기 →</button>
            <p className="hint center">저장을 마치셨으면 여기를 눌러 다음 서류를 만드세요.</p>
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

// 원장님이 가진 서식 붙여넣기 (한 번 넣으면 모든 달에 그 틀로)
function Sample({ label, value, onChange }) {
  const [open, setOpen] = useState(!!value);
  return (
    <div className="sample-box">
      <button type="button" className="sample-toggle" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {label}{value ? ' ✔' : ''}
      </button>
      {open && (
        <textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="가지고 계신 서식의 글을 그대로 붙여넣어 주세요. AI가 이 틀과 말투를 따라 만듭니다." />
      )}
    </div>
  );
}
