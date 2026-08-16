'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import { fileToResizedDataURL } from '../lib/image';
import {
  TYPES, PARTNERS, CHECKPOINTS, emptyData, emptyAct, actOf, planOf, whenText, attendText, totalCount,
  flowList, actHasContent, actDone, typeCounts, typeName, localNeedsParents,
  buildLinkDoc, buildOneActDoc, toHwpxBlocks,
} from '../lib/linkDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'link-wizard';
const MAX_PHOTOS = 4;

const STEPS = ['notice', 'record', 'done'];
const STEP_TITLE = {
  notice: '활동 안내문 만들기',
  record: '실시기록 만들기',
  done: '이 활동 정리본',
};

export default function LinkWizard({ onBack }) {
  const [data, setData] = useState(emptyData());
  const [basic, setBasic] = useState(null);
  // view: {v:'basic'} | {v:'plan'} | {v:'pick'} | {v:'step', q, s} | {v:'save'}
  const [view, setView] = useState({ v: 'basic' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const loadedRef = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info')]).then(([saved, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (saved?.year) {
        setData({ ...emptyData(), ...saved });
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
  const q = view.q ?? 0;
  const act = actOf(data, q);
  const plan = planOf(data, q);
  const counts = typeCounts(data);
  const list = Array.from({ length: data.count || 4 }, (_, i) => i);

  const upd = (patch) => setData((d) => ({
    ...d,
    acts: { ...d.acts, [q]: { ...emptyAct(), ...(d.acts?.[q] || {}), ...patch } },
  }));
  const updAct = (i, patch) => setData((d) => ({
    ...d,
    acts: { ...d.acts, [i]: { ...emptyAct(), ...(d.acts?.[i] || {}), ...patch } },
  }));

  const go = (v) => { setErr(''); setView(v); window.scrollTo(0, 0); };
  const stepIdx = STEPS.indexOf(view.s);
  const goStep = (s) => go({ v: 'step', q, s });
  const next = () => goStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)]);
  const prev = () => (stepIdx <= 0 ? go({ v: 'pick' }) : goStep(STEPS[stepIdx - 1]));

  const partnersText = [...(data.partners || []), data.partnerEtc].filter(Boolean).join(', ');

  async function ask(kind, extra = {}) {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, center, year: data.year, count: data.count,
          partners: partnersText,
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
    } finally { setBusy(false); }
  }

  async function makeNeed() {
    const j = await ask('need', data.need && data.needFeedback
      ? { previous: data.need, feedback: data.needFeedback } : {});
    if (j?.text) setData((d) => ({ ...d, need: j.text, needFeedback: '' }));
  }

  async function makePlan() {
    const j = await ask('plan', data.plan?.length && data.planFeedback
      ? {
        previous: data.plan.map((p) => `${p.month} | ${p.title} | ${p.partner} | ${(p.types || []).join(',')} | ${p.content}`).join('\n'),
        feedback: data.planFeedback,
      } : {});
    if (j?.result?.acts) {
      const got = j.result.acts;
      const plan = list.map((i) => {
        const x = got.find((y) => Number(y.i) === i) || got[i] || {};
        return {
          i, month: x.month || '', title: x.title || '', partner: x.partner || '',
          types: Array.isArray(x.types) ? x.types.filter((t) => TYPES.some((z) => z.key === t)) : [],
          content: x.content || '',
        };
      });
      // 계획의 유형·활동명·연계 대상을 활동에도 미리 채워 둔다
      setData((d) => {
        const acts = { ...d.acts };
        plan.forEach((p) => {
          const cur = acts[p.i] || emptyAct();
          acts[p.i] = {
            ...cur,
            title: cur.title || p.title,
            partner: cur.partner || p.partner,
            types: cur.types?.length ? cur.types : p.types,
          };
        });
        return { ...d, plan, acts, planFeedback: '' };
      });
    }
  }

  async function makeNotice() {
    const j = await ask('notice', {
      title: act.title || plan.title, partner: act.partner || plan.partner,
      types: (act.types || []).map(typeName).join(', '),
      when: whenText(act), place: act.place, target: act.target,
      ...(act.noticeGreeting && act.noticeFeedback
        ? { previous: `${act.noticeGreeting}\n\n${(act.noticeNotes || []).join('\n')}`, feedback: act.noticeFeedback } : {}),
    });
    if (j?.result) {
      upd({
        noticeGreeting: j.result.greeting || '',
        noticeNotes: Array.isArray(j.result.notes) ? j.result.notes : [],
        noticeFeedback: '',
      });
    }
  }

  async function makeRecord() {
    if (!act.memo?.trim()) { setErr('그날 어떻게 진행했는지 먼저 적어주세요.'); return; }
    const prevText = flowList(act).map((x) => `${x.time} ${x.content}`).join('\n');
    const j = await ask('record', {
      title: act.title || plan.title, partner: act.partner || plan.partner,
      types: (act.types || []).map(typeName).join(', '),
      when: whenText(act), place: act.place, target: act.target,
      attend: attendText(act) ? `${attendText(act)} (계 ${totalCount(act)}명)` : '',
      memo: act.memo,
      ...(prevText && act.recordFeedback
        ? { previous: `${prevText}\n\n${act.summary}`, feedback: act.recordFeedback } : {}),
    });
    if (j?.result) {
      upd({
        flow: Array.isArray(j.result.flow) ? j.result.flow : [],
        summary: j.result.summary || '',
        recordFeedback: '',
      });
    }
  }

  async function makeReview() {
    const j = await ask('review', {
      title: act.title || plan.title, partner: act.partner || plan.partner,
      memo: act.memo, attend: attendText(act),
      ...(act.review && act.reviewFeedback ? { previous: act.review, feedback: act.reviewFeedback } : {}),
    });
    if (j?.text) upd({ review: j.text, reviewFeedback: '' });
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      const room = MAX_PHOTOS - (act.photos?.length || 0);
      const urls = await Promise.all(files.slice(0, room).map((f) => fileToResizedDataURL(f)));
      upd({ photos: [...(act.photos || []), ...urls] });
    } catch {
      setErr('사진을 불러오지 못했습니다.');
    } finally { setBusy(false); }
  }

  const blocks = buildLinkDoc(data, basic || {});

  async function saveHwpx(only = null) {
    setBusy(true); setErr(''); setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const src = only === null ? blocks : buildOneActDoc(data, only, basic || {});
      const name = only === null
        ? `${center || '어린이집'}_연계협력활동.hwpx`
        : `${center || '어린이집'}_연계협력활동_${only + 1}회.hwpx`;
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(src), onProgress: setSaveMsg });
      downloadBlob(blob, name);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(false); }
  }

  function restart() {
    if (!window.confirm('연계·협력 활동 서류에 작성한 내용을 모두 지우고 처음부터 다시 할까요?')) return;
    clearForm(KEY);
    setData(emptyData());
    go({ v: 'basic' });
  }

  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const doneCount = list.filter((i) => actHasContent(actOf(data, i))).length;

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 새로 만들 서류 목록으로</button>

      {/* ① 기본사항 */}
      {view.v === 'basic' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">연계·협력 활동 · 1단계</div>
            <h1>어디와 · 몇 번 할지 정하기</h1>
          </div>

          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>{center || '우리 어린이집'}</b>의 연계·협력 활동 서류를 만듭니다.<br />
              다양성 영역은 <b>두 항목(15점)</b>이고, <b>같은 활동으로 양쪽 모두 인정</b>받을 수 있습니다.
            </p>
            <table className="doc-kv" style={{ marginBottom: 10 }}>
              <tbody>
                {TYPES.map((t) => (
                  <tr key={t.key}>
                    <th>{t.name}</th>
                    <td>
                      <b>{t.pt}점</b> · 연 {t.need}회 이상 · 서류제출<br />
                      <span className="hint" style={{ margin: 0 }}>{t.hint}</span><br />
                      <span className="hint" style={{ margin: 0, color: '#b3620a' }}>{t.must}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint" style={{ color: '#b3620a' }}>
              ⚠️ <b>지역사회 연계</b>는 <b>부모가 함께 참여</b>한 활동만 인정됩니다. 아이들만 다녀온 견학은 인정되지 않습니다.<br />
              ⚠️ 연계 대상은 <b>관내(우리 시·군 안)</b>의 어린이집·기관이어야 합니다.
            </p>
            <h3 className="wiz-sub">심사에서 확인하는 네 가지</h3>
            <ul className="check4">
              {CHECKPOINTS.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            <p className="hint">이 네 가지가 모두 갖춰지도록 <b>연간계획 → 안내문 → 실시기록</b> 순서로 만들어 드립니다.</p>
            {!center && <p className="error">⚠️ 기본사항에 어린이집 이름이 없습니다. 먼저 등록해 주세요.</p>}
          </div>

          <div className="card wiz-card">
            <h2 className="wiz-sub">① 연계할 수 있는 곳</h2>
            <p className="hint">우리 원 가까이에 있거나 함께해 본 곳을 골라주세요. 고른 곳으로 연간계획을 만들어 드립니다.</p>
            <div className="chk-list">
              {PARTNERS.map((p) => {
                const on = (data.partners || []).includes(p);
                return (
                  <label key={p} className={`chk ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on}
                      onChange={() => setData((d) => ({ ...d, partners: toggle(d.partners || [], p) }))} />
                    <span>{p}</span>
                  </label>
                );
              })}
            </div>
            <div className="field">
              <label>그 밖에 연계할 곳이 있으면 적어주세요 (선택)</label>
              <input type="text" value={data.partnerEtc} placeholder="예) ○○대학교 유아교육과, 이웃 ○○어린이집"
                onChange={(e) => setData((d) => ({ ...d, partnerEtc: e.target.value }))} />
            </div>
          </div>

          <div className="card wiz-card">
            <h2 className="wiz-sub">② 몇 번 할까요?</h2>
            <p className="hint">
              심사 요건은 <b>항목마다 연 2회 이상</b>입니다. 한 활동이 두 항목에 모두 해당되면 <b>4회</b>로 두 항목을 채울 수 있습니다.
            </p>
            <div className="field-row">
              <div className="field">
                <label>운영 연도</label>
                <input type="text" value={data.year} style={{ maxWidth: 140 }}
                  onChange={(e) => setData((d) => ({ ...d, year: e.target.value }))} />
              </div>
              <div className="field">
                <label>활동 횟수</label>
                <select value={data.count} onChange={(e) => setData((d) => ({ ...d, count: Number(e.target.value) }))}>
                  {[4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}회</option>)}
                </select>
              </div>
            </div>
            <button className="next-doc" disabled={!(data.partners || []).length && !data.partnerEtc?.trim()}
              onClick={() => go({ v: 'plan' })}>
              연간계획 만들기 →
            </button>
            {!(data.partners || []).length && !data.partnerEtc?.trim() && (
              <p className="hint center">※ 연계할 곳을 하나 이상 골라주세요.</p>
            )}
          </div>
        </>
      )}

      {/* ② 연간계획 */}
      {view.v === 'plan' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">연계·협력 활동 · 2단계</div>
            <h1>{data.year}년 연간계획</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'basic' })}>← 연계할 곳 다시 고르기</button>

          <div className="card wiz-card">
            <p className="wiz-lead">
              고르신 곳으로 <b>{data.count}회</b> 활동 계획을 만들어 드립니다.
              <b> 어린이집 간 연계 2회 · 지역사회 연계 2회</b>가 채워지도록 배정합니다.
            </p>
            <button className="primary" onClick={makePlan} disabled={busy}>
              {busy ? 'AI가 계획을 세우는 중입니다…' : `✍️ ${data.plan?.length ? '다시 ' : ''}연간계획 만들기`}
            </button>
            {err && <p className="error">⚠️ {err}</p>}
          </div>

          {!!data.plan?.length && (
            <div className="card wiz-card">
              <h2 className="wiz-sub">연간계획표 <span className="edit-badge">✏️ 칸을 눌러 바로 고치세요</span></h2>
              {data.plan.map((p) => (
                <div className="link-row" key={p.i}>
                  <div className="link-no">{p.i + 1}회</div>
                  <div className="link-fields">
                    <input type="text" value={p.month} placeholder="시기 (예: 2026년 5월)"
                      onChange={(e) => setData((d) => ({ ...d, plan: d.plan.map((x) => (x.i === p.i ? { ...x, month: e.target.value } : x)) }))} />
                    <input type="text" value={p.title} placeholder="활동명"
                      onChange={(e) => setData((d) => ({ ...d, plan: d.plan.map((x) => (x.i === p.i ? { ...x, title: e.target.value } : x)) }))} />
                    <input type="text" value={p.partner} placeholder="연계 대상"
                      onChange={(e) => setData((d) => ({ ...d, plan: d.plan.map((x) => (x.i === p.i ? { ...x, partner: e.target.value } : x)) }))} />
                    <input type="text" value={p.content} placeholder="주요 내용"
                      onChange={(e) => setData((d) => ({ ...d, plan: d.plan.map((x) => (x.i === p.i ? { ...x, content: e.target.value } : x)) }))} />
                    <div className="type-chips">
                      {TYPES.map((t) => {
                        const on = (actOf(data, p.i).types || []).includes(t.key);
                        return (
                          <button key={t.key} type="button" className={`type-chip ${on ? 'on' : ''}`}
                            onClick={() => updAct(p.i, { types: toggle(actOf(data, p.i).types || [], t.key) })}>
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div className="field">
                <label>계획을 통째로 고치고 싶으면 알려주세요 (선택)</label>
                <input type="text" value={data.planFeedback}
                  onChange={(e) => setData((d) => ({ ...d, planFeedback: e.target.value }))}
                  placeholder="예) 소방서 방문을 봄으로 옮기고, 도서관 활동을 늘려주세요" />
              </div>
              {data.planFeedback?.trim() && (
                <button className="ghost" onClick={makePlan} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
              )}
              <button className="next-doc" onClick={() => go({ v: 'pick' })}>활동별 자료 만들기 →</button>
            </div>
          )}
        </>
      )}

      {/* ③ 활동 고르기 */}
      {view.v === 'pick' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">연계·협력 활동 · 3단계</div>
            <h1>활동별 자료 만들기</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'plan' })}>← 연간계획 고치기</button>

          <div className="card wiz-card">
            <p className="wiz-lead">활동을 골라 <b>안내문 → 실시기록</b> 순서로 만듭니다.</p>
            <div className="type-status">
              {TYPES.map((t) => (
                <div key={t.key} className={`type-stat ${counts[t.key] >= t.need ? 'ok' : ''}`}>
                  <b>{t.name}</b>
                  <span>{counts[t.key]} / {t.need}회</span>
                  <em>{counts[t.key] >= t.need ? '충족' : `${t.need - counts[t.key]}회 더 필요`}</em>
                </div>
              ))}
            </div>
            <div className="q-grid month">
              {list.map((i) => {
                const a = actOf(data, i);
                const p = planOf(data, i);
                const done = actDone(a);
                return (
                  <button key={i} className={`q-card ${done ? 'done' : ''}`} onClick={() => go({ v: 'step', q: i, s: 'notice' })}>
                    <div className="q-top">
                      <b>{i + 1}회</b>
                      <span className={`q-chip ${done ? 'ok' : ''}`}>{done ? '완성' : actHasContent(a) ? '작성 중' : '아직'}</span>
                    </div>
                    <div className="q-when">{a.title || p.title || '활동명 미정'}</div>
                    <div className="q-date">{a.partner || p.partner || ''}{a.date ? ` · ${whenText(a)}` : ''}</div>
                  </button>
                );
              })}
            </div>
            <p className="hint">{doneCount}/{data.count} 활동을 작성했습니다.</p>
            <button className="next-doc" onClick={() => go({ v: 'save' })}>📄 전체 문서 보기 · 저장하기 →</button>
            <div className="wiz-nav">
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
            </div>
          </div>
        </>
      )}

      {/* 활동별 단계 */}
      {view.v === 'step' && (
        <>
          <div className="wiz-head">
            <div className="wiz-bar"><span style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} /></div>
            <div className="wiz-count">{stepIdx + 1} / {STEPS.length} 단계 · {q + 1}회 활동</div>
            <h1>{STEP_TITLE[view.s]}</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'pick' })}>← 활동 목록으로</button>

          {/* 안내문 */}
          {view.s === 'notice' && (
            <>
              <div className="card wiz-card">
                <p className="wiz-lead">
                  <b>{act.title || plan.title || '활동명 미정'}</b> · {act.partner || plan.partner || '연계 대상 미정'}<br />
                  먼저 <b>언제·어디서·누가</b>를 정하고 안내문을 만듭니다.
                </p>
                <div className="field-row">
                  <div className="field">
                    <label>활동명</label>
                    <input type="text" value={act.title} placeholder={plan.title || '예) 도서관과 함께하는 그림책 나들이'}
                      onChange={(e) => upd({ title: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>연계 대상</label>
                    <input type="text" value={act.partner} placeholder={plan.partner || '예) 구립도서관'}
                      onChange={(e) => upd({ partner: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>인정받을 항목 (해당되는 것을 모두 고르세요)</label>
                  <div className="type-chips">
                    {TYPES.map((t) => {
                      const on = (act.types || []).includes(t.key);
                      return (
                        <button key={t.key} type="button" className={`type-chip ${on ? 'on' : ''}`}
                          onClick={() => upd({ types: toggle(act.types || [], t.key) })}>
                          {t.name} <em>{t.pt}점</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>날짜</label>
                    <input type="date" value={act.date} onChange={(e) => upd({ date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>시간</label>
                    <input type="text" value={act.time} placeholder="예) 오전 10:00 ~ 11:30"
                      onChange={(e) => upd({ time: e.target.value })} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>장소</label>
                    <input type="text" value={act.place} placeholder="예) 구립도서관 어린이자료실"
                      onChange={(e) => upd({ place: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>대상</label>
                    <input type="text" value={act.target} onChange={(e) => upd({ target: e.target.value })} />
                  </div>
                </div>

                <Sample label="가지고 계신 안내문 서식이 있으면 붙여넣어 주세요 (선택)"
                  value={data.samples.notice} onChange={(v) => setData((d) => ({ ...d, samples: { ...d.samples, notice: v } }))} />
                <button className="primary" onClick={makeNotice} disabled={busy || !act.date}>
                  {busy ? 'AI가 작성 중입니다…' : `✍️ ${act.noticeGreeting ? '다시 ' : ''}안내문 만들기`}
                </button>
                {!act.date && <p className="hint">※ 날짜를 먼저 넣어주세요.</p>}
                {err && <p className="error">⚠️ {err}</p>}

                {act.noticeGreeting && (
                  <>
                    <div className="wiz-result">
                      <div className="wiz-result-top">안내문 본문 <span>✏️ 직접 고쳐도 됩니다</span></div>
                      <textarea rows={7} value={act.noticeGreeting} onChange={(e) => upd({ noticeGreeting: e.target.value })} />
                    </div>
                    <div className="wiz-result">
                      <div className="wiz-result-top">참고사항 <span>✏️ 한 줄에 하나씩</span></div>
                      <textarea rows={4} value={(act.noticeNotes || []).join('\n')}
                        onChange={(e) => upd({ noticeNotes: e.target.value.split('\n') })} />
                    </div>
                    <div className="field">
                      <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                      <input type="text" value={act.noticeFeedback} onChange={(e) => upd({ noticeFeedback: e.target.value })} />
                    </div>
                    {act.noticeFeedback?.trim() && (
                      <button className="ghost" onClick={makeNotice} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                    )}
                  </>
                )}
                <div className="wiz-nav">
                  <button className="ghost" onClick={() => go({ v: 'pick' })}>← 활동 목록</button>
                  <button className="primary" onClick={next} disabled={!act.noticeGreeting}>실시기록 만들기 →</button>
                </div>
              </div>
            </>
          )}

          {/* 실시기록 */}
          {view.s === 'record' && (
            <div className="card wiz-card">
              <p className="wiz-lead">
                실제로 어떻게 했는지 적어주세요. <b>운영일시 · 참석자 · 활동내용</b>이 심사에서 보는 세 가지입니다.
              </p>
              {localNeedsParents(act) && (
                <p className="error">
                  ⚠️ 이 활동은 <b>지역사회 연계</b>로 인정받으려 하는데 <b>부모 참석 인원이 0명</b>입니다.
                  부모가 함께 참여해야 인정되니 인원을 확인해 주세요.
                </p>
              )}
              <h3 className="wiz-sub">참석 인원</h3>
              <div className="field-row">
                <div className="field">
                  <label>부모 (명)</label>
                  <input type="text" inputMode="numeric" value={act.parents} onChange={(e) => upd({ parents: e.target.value })} />
                </div>
                <div className="field">
                  <label>영유아 (명)</label>
                  <input type="text" inputMode="numeric" value={act.kids} onChange={(e) => upd({ kids: e.target.value })} />
                </div>
                <div className="field">
                  <label>교직원 (명)</label>
                  <input type="text" inputMode="numeric" value={act.staff} onChange={(e) => upd({ staff: e.target.value })} />
                </div>
              </div>
              {totalCount(act) > 0 && <p className="hint">→ <b>{attendText(act)} (계 {totalCount(act)}명)</b></p>}

              <Sample label="가지고 계신 실시기록 서식이 있으면 붙여넣어 주세요 (선택)"
                value={data.samples.record} onChange={(v) => setData((d) => ({ ...d, samples: { ...d.samples, record: v } }))} />
              <div className="field">
                <label>그날 어떻게 진행했는지 메모 <span className="edit-badge">✏️ 편하게 적으시면 AI가 정리합니다</span></label>
                <textarea rows={9} value={act.memo}
                  placeholder={'예) 10시 도서관 도착, 사서 선생님 인사\n10시 20분 그림책 읽어주기\n11시 부모와 아이가 함께 책 고르고 대출\n부모님들이 동네 도서관을 알게 되어 좋았다고 함'}
                  onChange={(e) => upd({ memo: e.target.value })} />
              </div>
              <button className="primary" onClick={makeRecord} disabled={busy}>
                {busy ? 'AI가 정리 중입니다…' : `✍️ ${flowList(act).length ? '다시 ' : ''}실시기록으로 정리하기`}
              </button>
              {err && <p className="error">⚠️ {err}</p>}

              {!!flowList(act).length && (
                <>
                  <div className="wiz-result">
                    <div className="wiz-result-top">진행 순서 <span>✏️ 직접 고쳐도 됩니다</span></div>
                    {act.flow.map((x, n) => (
                      <div className="flow-row" key={n}>
                        <input type="text" className="flow-time" value={x.time || ''} placeholder="시간"
                          onChange={(e) => upd({ flow: act.flow.map((y, i) => (i === n ? { ...y, time: e.target.value } : y)) })} />
                        <textarea rows={2} value={x.content || ''}
                          onChange={(e) => upd({ flow: act.flow.map((y, i) => (i === n ? { ...y, content: e.target.value } : y)) })} />
                        <button type="button" className="mem-del" onClick={() => upd({ flow: act.flow.filter((_, i) => i !== n) })}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="ghost sm" onClick={() => upd({ flow: [...act.flow, { time: '', content: '' }] })}>＋ 줄 추가</button>
                  </div>
                  <div className="wiz-result">
                    <div className="wiz-result-top">활동 진행내용 <span>✏️ 직접 고쳐도 됩니다</span></div>
                    <textarea rows={7} value={act.summary} onChange={(e) => upd({ summary: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                    <input type="text" value={act.recordFeedback} onChange={(e) => upd({ recordFeedback: e.target.value })} />
                  </div>
                  {act.recordFeedback?.trim() && (
                    <button className="ghost" onClick={makeRecord} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                  )}

                  <h3 className="wiz-sub">평가 (선택)</h3>
                  <button className="ghost" onClick={makeReview} disabled={busy}>
                    {busy ? 'AI가 작성 중입니다…' : `✍️ ${act.review ? '다시 ' : ''}평가 쓰기`}
                  </button>
                  {act.review && (
                    <div className="wiz-result">
                      <div className="wiz-result-top">평가 <span>✏️ 직접 고쳐도 됩니다</span></div>
                      <textarea rows={6} value={act.review} onChange={(e) => upd({ review: e.target.value })} />
                    </div>
                  )}
                </>
              )}

              <h3 className="wiz-sub">활동 사진 (없으면 넘어가셔도 됩니다)</h3>
              <div className="img-grid">
                {(act.photos || []).map((src, i) => (
                  <div className="img-thumb sm" key={i}>
                    <img src={src} alt="" />
                    <button type="button" className="img-del" onClick={() => upd({ photos: act.photos.filter((_, x) => x !== i) })}>✕</button>
                  </div>
                ))}
                {(act.photos?.length || 0) < MAX_PHOTOS && (
                  <label className={`img-upload sm ${busy ? 'busy' : ''}`}>
                    {busy ? '불러오는 중…' : '＋ 사진 추가'}
                    <input type="file" accept="image/*" multiple hidden disabled={busy}
                      onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                  </label>
                )}
              </div>

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next} disabled={!flowList(act).length}>{q + 1}회 정리본 보기 →</button>
              </div>
            </div>
          )}

          {/* 정리본 */}
          {view.s === 'done' && (
            <>
              <div className="card wiz-card">
                <p className="wiz-lead"><b>{q + 1}회 활동 정리본</b>입니다. <b>안내문 + 실시기록</b>이 한 세트로 들어 있습니다.</p>
                <div className="wiz-saves">
                  <button className="primary" onClick={() => window.print()}>🖨️ 이 활동만 PDF로 저장</button>
                  <button className="ghost" onClick={() => saveHwpx(q)} disabled={busy}>📄 이 활동만 한글로 저장</button>
                </div>
                {saveMsg && <p className="hint">{saveMsg}</p>}
                {err && <p className="error">⚠️ {err}</p>}
                {q < list.length - 1 && (
                  <button className="next-doc" onClick={() => go({ v: 'step', q: q + 1, s: 'notice' })}>
                    ✅ 확인했습니다 · {q + 2}회 이어서 만들기 →
                  </button>
                )}
                <button className="next-doc calm" onClick={() => go({ v: 'save' })}>
                  📄 여기까지 만든 것으로 문서 정리하기 →
                </button>
                <div className="wiz-nav">
                  <button className="ghost" onClick={prev}>← 이전</button>
                  <button className="ghost" onClick={() => go({ v: 'pick' })}>활동 목록으로</button>
                </div>
              </div>
              <div className="page-outer">
                <div className="print-area">
                  <PrintSheet>
                    {buildOneActDoc(data, q, basic || {}).map((b, i) => <Block key={i} b={b} />)}
                  </PrintSheet>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* 저장 */}
      {view.v === 'save' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">연계·협력 활동 · 문서 저장</div>
            <h1>문서 저장하기</h1>
          </div>
          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>필요성 → 연간계획 → 활동별 [안내문 + 실시기록] → 심사 항목별 실시 현황</b> 순서로 묶었습니다.
            </p>

            <h3 className="wiz-sub">조사의 필요성</h3>
            <p className="hint">문서 맨 앞에 들어갑니다. 비워 두면 기본 문구가 들어갑니다.</p>
            <button className="primary" onClick={makeNeed} disabled={busy}>
              {busy ? 'AI가 작성 중입니다…' : `✍️ ${data.need ? '다시 ' : ''}필요성 쓰기`}
            </button>
            {data.need && (
              <div className="wiz-result">
                <div className="wiz-result-top">연계·협력 활동의 필요성 <span>✏️ 직접 고쳐도 됩니다</span></div>
                <textarea rows={8} value={data.need} onChange={(e) => setData((d) => ({ ...d, need: e.target.value }))} />
              </div>
            )}

            <div className="type-status">
              {TYPES.map((t) => (
                <div key={t.key} className={`type-stat ${counts[t.key] >= t.need ? 'ok' : ''}`}>
                  <b>{t.name}</b>
                  <span>{counts[t.key]} / {t.need}회</span>
                  <em>{counts[t.key] >= t.need ? '충족' : `${t.need - counts[t.key]}회 더 필요`}</em>
                </div>
              ))}
            </div>

            <div className="wiz-saves">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (사진 포함)</button>
              <button className="ghost" onClick={() => saveHwpx()} disabled={busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            {err && <p className="error">⚠️ {err}</p>}
            <div className="wiz-nav">
              <button className="ghost" onClick={() => go({ v: 'pick' })}>← 활동 목록으로</button>
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
            </div>
            <button className="next-doc" onClick={onBack}>📋 목차로 이동 · 다음 문서 만들기 →</button>
          </div>
          <div className="page-outer">
            <div className="print-area">
              <PrintSheet>{blocks.map((b, i) => <Block key={i} b={b} />)}</PrintSheet>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Sample({ label, value, onChange }) {
  const [open, setOpen] = useState(!!value);
  return (
    <div className="sample-box">
      <button type="button" className="sample-toggle" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} {label}{value ? ' ✔' : ''}
      </button>
      {open && (
        <textarea rows={6} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="가지고 계신 서식의 글을 그대로 붙여넣어 주세요." />
      )}
    </div>
  );
}
