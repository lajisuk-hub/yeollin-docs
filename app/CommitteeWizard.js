'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import { fileToResizedDataURL } from '../lib/image';
import {
  MEETINGS, YEARS, MEMBER_ROLES, emptyData, emptyMeeting, suggestMembers,
  whenText, agendaList, meetingHasContent, meetingDone, membersOf, attendText,
  defaultRulesText, defaultOrder, qLabel, buildCommitteeDoc, buildOneMeetingDoc, toHwpxBlocks,
} from '../lib/committeeDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'committee-wizard';
const MAX_PHOTOS = 4;

// 한 차수 안에서 지나가는 단계
const STEPS = ['agenda', 'notice', 'minutes', 'result', 'photos', 'done'];
const STEP_TITLE = {
  agenda: '참석자와 안건',
  notice: '개최 공지문 만들기',
  minutes: '회의록 만들기',
  result: '회의결과 공지문 만들기',
  photos: '회의 사진 넣기',
  done: '이 차수 문서 정리본',
};

export default function CommitteeWizard({ onBack }) {
  const [data, setData] = useState(emptyData());
  const [basic, setBasic] = useState(null);
  // view: {v:'basic'} | {v:'rules'} | {v:'pick'} | {v:'step', q, s} | {v:'save'}
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
      if (saved?.meetings) {
        setData({ ...emptyData(), ...saved });
        if (saved.view) setView(saved.view);
      } else {
        const m = suggestMembers(b);
        setData({ ...emptyData(), members: { 2025: m, 2026: m.map((x) => ({ ...x })) } });
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
  const info = MEETINGS[q];
  const meeting = data.meetings[q] || emptyMeeting();
  const members = membersOf(data, q);

  const upd = (patch) => setData((d) => ({
    ...d,
    meetings: d.meetings.map((m, i) => (i === q ? { ...m, ...patch } : m)),
  }));
  const updMeeting = (i, patch) => setData((d) => ({
    ...d,
    meetings: d.meetings.map((m, n) => (n === i ? { ...m, ...patch } : m)),
  }));
  const setMembers = (year, list) => setData((d) => ({ ...d, members: { ...d.members, [year]: list } }));
  const setRules = (year, patch) => setData((d) => ({ ...d, rules: { ...d.rules, [year]: { ...d.rules[year], ...patch } } }));

  const go = (v) => { setErr(''); setView(v); window.scrollTo(0, 0); };
  const stepIdx = STEPS.indexOf(view.s);
  const goStep = (s) => go({ v: 'step', q, s });
  const next = () => goStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)]);
  const prev = () => (stepIdx <= 0 ? go({ v: 'pick' }) : goStep(STEPS[stepIdx - 1]));

  // ── AI 부르기 ──
  async function ask(kind, extra = {}) {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/committee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          center,
          quarter: `${info.no} · ${qLabel(q)} (회계연도 ${info.year}년도)`,
          when: whenText(meeting),
          place: meeting.place,
          attend: attendText(members, meeting),
          agenda: agendaList(meeting).map((t, i) => `${i + 1}. ${t}`).join('\n'),
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

  async function makeNotice() {
    const j = await ask('notice', meeting.notice && meeting.noticeFeedback
      ? { previous: meeting.notice, feedback: meeting.noticeFeedback } : {});
    if (j?.text) upd({ notice: j.text, noticeFeedback: '' });
  }

  async function makeMinutes() {
    if (!meeting.memo?.trim()) { setErr('회의에서 오간 이야기를 먼저 적어주세요.'); return; }
    const j = await ask('minutes', {
      memo: meeting.memo,
      ...(meeting.discussion && meeting.minutesFeedback
        ? { previous: `[회의순서]\n${meeting.order}\n\n[토의 및 의결사항]\n${meeting.discussion}`, feedback: meeting.minutesFeedback } : {}),
    });
    if (j?.result) upd({ order: j.result.order || defaultOrder(meeting), discussion: j.result.discussion || '', minutesFeedback: '' });
  }

  async function makeResult() {
    const j = await ask('result', {
      memo: meeting.memo, decisions: meeting.discussion,
      ...(meeting.result && meeting.resultFeedback
        ? { previous: meeting.result, feedback: meeting.resultFeedback } : {}),
    });
    if (j?.text) upd({ result: j.text, resultFeedback: '' });
  }

  async function makeFeature() {
    const j = await ask('feature', {
      memo: meeting.memo, decisions: meeting.discussion,
      ...(meeting.feature && meeting.featureFeedback
        ? { previous: meeting.feature, feedback: meeting.featureFeedback } : {}),
    });
    if (j?.text) upd({ feature: j.text, featureFeedback: '' });
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    setErr('');
    try {
      const room = MAX_PHOTOS - (meeting.photos?.length || 0);
      const urls = await Promise.all(files.slice(0, room).map((f) => fileToResizedDataURL(f)));
      upd({ photos: [...(meeting.photos || []), ...urls] });
    } catch {
      setErr('사진을 불러오지 못했습니다. 다른 사진으로 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  const blocks = buildCommitteeDoc(data, basic || {});

  async function saveHwpx() {
    setBusy(true);
    setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_운영위원회_운영결과.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    if (!window.confirm('운영위원회 서류에 작성한 내용을 모두 지우고 처음부터 다시 할까요?')) return;
    clearForm(KEY);
    const m = suggestMembers(basic);
    setData({ ...emptyData(), members: { 2025: m, 2026: m.map((x) => ({ ...x })) } });
    go({ v: 'basic' });
  }

  const doneCount = data.meetings.filter(meetingHasContent).length;
  const schedOk = data.meetings.every((m) => m.date);

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 새로 만들 서류 목록으로</button>

      {/* ───────── 1. 기본사항 ───────── */}
      {view.v === 'basic' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">운영위원회 · 1단계</div>
            <h1>기본사항 작성</h1>
          </div>

          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>{center || '우리 어린이집'}</b>의 운영위원회 서류를 만듭니다.<br />
              심사는 <b>직전 1년</b>을 보므로 <b>2025년 4분기부터 2026년 3분기까지 네 번</b>을 1~4차로 정리합니다.
            </p>
            <ul className="wiz-steps">
              <li><b>기본사항</b> — 25·26년 운영위원 명단, 네 차례 회의 일정</li>
              <li><b>회칙</b> — 25년·26년 회칙 확인</li>
              <li><b>1차 → 2차 → 3차 → 4차</b> — 공지문 · 회의록 · 결과공지문 · 특징정리</li>
            </ul>
            <p className="hint">중간에 창을 닫아도 <b>여기까지 한 내용은 저장</b>됩니다.</p>
            {!center && <p className="error">⚠️ 기본사항에 어린이집 이름이 없습니다. 먼저 등록하시면 문서에 자동으로 들어갑니다.</p>}
          </div>

          {YEARS.map((y) => (
            <MemberCard key={y} year={y} members={data.members[y] || []}
              onChange={(list) => setMembers(y, list)}
              onCopy={y === '2026' ? () => setMembers('2026', (data.members['2025'] || []).map((x) => ({ ...x }))) : null}
            />
          ))}

          <div className="card wiz-card">
            <h2 className="wiz-sub">운영위원회 회의 일정</h2>
            <p className="hint">네 번의 회의를 <b>언제 열었는지</b> 적어주세요. 분기는 어린이집 회계연도 기준입니다.</p>
            {MEETINGS.map((mi, i) => (
              <div className="sched-row" key={i}>
                <div className="sched-tag">
                  <b>{mi.no}</b>
                  <span>{mi.quarter}</span>
                  <em>{mi.when}</em>
                  {mi.note && <i>※ {mi.note}</i>}
                </div>
                <div className="sched-inputs">
                  <input type="date" value={data.meetings[i].date}
                    onChange={(e) => updMeeting(i, { date: e.target.value })} />
                  <input type="text" value={data.meetings[i].time} placeholder="예) 오전 10:30 ~ 12:30"
                    onChange={(e) => updMeeting(i, { time: e.target.value })} />
                  <input type="text" value={data.meetings[i].place} placeholder="장소"
                    onChange={(e) => updMeeting(i, { place: e.target.value })} />
                </div>
              </div>
            ))}
            {!schedOk && <p className="hint" style={{ color: '#b8860b' }}>※ 네 번의 날짜를 모두 넣으면 다음으로 넘어갈 수 있습니다.</p>}
            <button className="next-doc" disabled={!schedOk} onClick={() => go({ v: 'rules' })}>
              회칙 확인하기 →
            </button>
          </div>
        </>
      )}

      {/* ───────── 2. 회칙 ───────── */}
      {view.v === 'rules' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">운영위원회 · 2단계</div>
            <h1>운영위원회 회칙</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'basic' })}>← 기본사항 고치기</button>

          <div className="card wiz-card">
            <p className="wiz-lead">
              원장님 회칙 서식을 <b>2025년판 · 2026년판</b>으로 각각 맞춰 두었습니다.
              위원 정수와 임기 날짜는 <b>등록한 명단·연도에 맞춰 자동</b>으로 들어갑니다.
            </p>
            <p className="hint" style={{ color: '#b3620a' }}>
              ※ 원본 서식의 제14조는 <b>정기회를 상·하반기 각 1회</b>로 정하고 있었습니다.
              열린어린이집은 <b>분기별 1회(연 4회)</b>를 요구하므로, 회칙과 실제 운영이 어긋나지 않도록 <b>분기별 1회로 고쳐</b> 두었습니다.
            </p>
          </div>

          {YEARS.map((y) => (
            <div className="card wiz-card" key={y}>
              <h2 className="wiz-sub">{y}년 회칙</h2>
              <div className="wiz-result">
                <div className="wiz-result-top">회칙 전문 <span>— 직접 고쳐도 됩니다</span></div>
                <textarea rows={16}
                  value={data.rules[y]?.text || defaultRulesText(y, center || '○○어린이집')}
                  onChange={(e) => setRules(y, { text: e.target.value })} />
              </div>
              <button className="ghost sm" onClick={() => setRules(y, { text: defaultRulesText(y, center || '○○어린이집') })}>
                기본 회칙으로 되돌리기
              </button>
            </div>
          ))}

          <div className="card wiz-card">
            <button className="next-doc" onClick={() => go({ v: 'pick' })}>차수별 서류 만들기 →</button>
          </div>
        </>
      )}

      {/* ───────── 3. 차수 고르기 ───────── */}
      {view.v === 'pick' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">운영위원회 · 3단계</div>
            <h1>차수별 서류 만들기</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'rules' })}>← 회칙 고치기</button>

          <div className="card wiz-card">
            <p className="wiz-lead">차수를 골라 <b>공지문 → 회의록 → 결과공지문</b> 순서로 만듭니다. <b>1차부터</b> 차례로 하시면 됩니다.</p>
            <div className="q-grid">
              {MEETINGS.map((mi, i) => {
                const m = data.meetings[i];
                const done = meetingDone(m);
                const some = meetingHasContent(m);
                return (
                  <button key={i} className={`q-card ${done ? 'done' : ''}`} onClick={() => go({ v: 'step', q: i, s: 'agenda' })}>
                    <div className="q-top">
                      <b>{mi.no}</b>
                      <span className={`q-chip ${done ? 'ok' : ''}`}>{done ? '완성' : some ? '작성 중' : '아직'}</span>
                    </div>
                    <div className="q-when">{mi.quarter}</div>
                    {m.date && <div className="q-date">{whenText(m)}</div>}
                  </button>
                );
              })}
            </div>
            <p className="hint">{doneCount}/4 차수를 작성했습니다.</p>
            <button className="next-doc" onClick={() => go({ v: 'save' })}>
              📄 지금까지 만든 것으로 전체 문서 보기 · 저장하기 →
            </button>
            <div className="wiz-nav">
              <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
            </div>
          </div>
        </>
      )}

      {/* ───────── 차수별 단계 ───────── */}
      {view.v === 'step' && (
        <>
          <div className="wiz-head">
            <div className="wiz-bar"><span style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} /></div>
            <div className="wiz-count">{stepIdx + 1} / {STEPS.length} 단계 · {info.no} ({info.quarter})</div>
            <h1>{STEP_TITLE[view.s]}</h1>
          </div>
          <button className="gate-back" onClick={() => go({ v: 'pick' })}>← 차수 목록으로</button>

          {/* 참석자·안건 */}
          {view.s === 'agenda' && (
            <div className="card wiz-card">
              <p className="wiz-lead">
                <b>{whenText(meeting) || '일시 미입력'}</b> / {meeting.place || '장소 미입력'}
                <br />참석한 위원을 고르고, 다룬 안건을 한 줄에 하나씩 적어주세요.
              </p>
              <h3 className="wiz-sub">참석한 위원 <span className="wiz-sub-c">{info.year}년 명단</span></h3>
              {members.length === 0 ? (
                <p className="hint">위원 명단이 비어 있습니다. <b>기본사항</b>으로 돌아가 등록해 주세요.</p>
              ) : (
                <div className="chk-list">
                  {members.map((x) => {
                    const on = !(meeting.absent || []).includes(x.name);
                    return (
                      <label key={x.name} className={`chk ${on ? 'on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => {
                          const absent = meeting.absent || [];
                          upd({ absent: on ? [...absent, x.name] : absent.filter((n) => n !== x.name) });
                        }} />
                        <span>{x.name} <em>{x.role}</em></span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="field-row">
                <div className="field">
                  <label>간사 (회의록 작성자)</label>
                  <input type="text" value={meeting.secretary} placeholder="예) 김교사"
                    onChange={(e) => upd({ secretary: e.target.value })} />
                </div>
                <div className="field">
                  <label>그 밖의 참석자 (선택)</label>
                  <input type="text" value={meeting.guests} placeholder="예) 참관 학부모 1명"
                    onChange={(e) => upd({ guests: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>안건</label>
                <textarea rows={6} value={meeting.agenda} onChange={(e) => upd({ agenda: e.target.value })}
                  placeholder={'예)\n2026학년도 보육과정 운영 계획\n급식·간식 식단 운영과 위생 관리\n어린이집 안전관리 및 등하원 차량 점검\n부모참여 행사 연간 일정'} />
              </div>
              <div className="wiz-nav">
                <button className="ghost" onClick={() => go({ v: 'pick' })}>← 차수 목록</button>
                <button className="primary" onClick={next} disabled={!agendaList(meeting).length}>개최 공지문 만들기 →</button>
              </div>
            </div>
          )}

          {/* 개최 공지문 */}
          {view.s === 'notice' && (
            <AiStep
              lead={<>회의 <b>전에</b> 부모님께 알리는 <b>개최 공지문</b>을 만들어 드릴게요. 일시·장소·안건이 그대로 들어갑니다.</>}
              sampleLabel="가지고 계신 개최 공지문 서식이 있으면 붙여넣어 주세요 (선택 · 한 번만 넣으면 네 차수 모두 이 틀로 만듭니다)"
              sample={data.samples.notice} onSample={(v) => setData((d) => ({ ...d, samples: { ...d.samples, notice: v } }))}
              value={meeting.notice} onChange={(v) => upd({ notice: v })}
              feedback={meeting.noticeFeedback} onFeedback={(v) => upd({ noticeFeedback: v })}
              onMake={makeNotice} busy={busy} err={err}
              makeLabel="개최 공지문 만들기" nextLabel="회의록 만들기 →"
              onPrev={prev} onNext={next}
            />
          )}

          {/* 회의록 */}
          {view.s === 'minutes' && (
            <div className="card wiz-card">
              <p className="wiz-lead">회의에서 <b>오간 이야기와 정해진 것</b>을 편하게 적어주세요. AI가 회의록 문체로 정리해 드립니다.</p>
              <Sample label="가지고 계신 회의록 서식이 있으면 붙여넣어 주세요 (선택)"
                value={data.samples.minutes} onChange={(v) => setData((d) => ({ ...d, samples: { ...d.samples, minutes: v } }))} />
              <div className="field">
                <label>논의·결정 메모</label>
                <textarea rows={8} value={meeting.memo} onChange={(e) => upd({ memo: e.target.value })}
                  placeholder={'예)\n급식 - 여름철 식중독 걱정된다는 의견. 조리실 위생점검 매주 하기로 함\n안전 - 등하원 차량 안전벨트 확인 철저히. 부모에게도 안내하기로\n행사 - 부모참여수업 6월 셋째 주 토요일로 정함'} />
              </div>
              <button className="primary" onClick={makeMinutes} disabled={busy}>
                {busy ? 'AI가 정리 중입니다…' : `✍️ ${meeting.discussion ? '다시 ' : ''}회의록으로 정리하기`}
              </button>
              {err && <p className="error">⚠️ {err}</p>}

              {meeting.discussion && (
                <>
                  <div className="wiz-result">
                    <div className="wiz-result-top">회의순서 <span>— 직접 고쳐도 됩니다</span></div>
                    <textarea rows={7} value={meeting.order} onChange={(e) => upd({ order: e.target.value })} />
                  </div>
                  <div className="wiz-result">
                    <div className="wiz-result-top">토의 및 의결사항 <span>— 직접 고쳐도 됩니다</span></div>
                    <textarea rows={14} value={meeting.discussion} onChange={(e) => upd({ discussion: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                    <input type="text" value={meeting.minutesFeedback} onChange={(e) => upd({ minutesFeedback: e.target.value })}
                      placeholder="예) 급식 안건을 더 자세히 써주세요" />
                  </div>
                  {meeting.minutesFeedback?.trim() && (
                    <button className="ghost" onClick={makeMinutes} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                  )}
                </>
              )}

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next} disabled={!meeting.discussion}>결과 공지문 만들기 →</button>
              </div>
            </div>
          )}

          {/* 결과 공지문 */}
          {view.s === 'result' && (
            <AiStep
              lead={<>회의 <b>후에</b> 부모님께 알리는 <b>회의결과 공지문</b>을 만들어 드릴게요. 결정 사항이 그대로 들어갑니다.</>}
              sampleLabel="가지고 계신 결과 공지문 서식이 있으면 붙여넣어 주세요 (선택)"
              sample={data.samples.result} onSample={(v) => setData((d) => ({ ...d, samples: { ...d.samples, result: v } }))}
              value={meeting.result} onChange={(v) => upd({ result: v })}
              feedback={meeting.resultFeedback} onFeedback={(v) => upd({ resultFeedback: v })}
              onMake={makeResult} busy={busy} err={err}
              makeLabel="결과 공지문 만들기" nextLabel="사진 넣기 →"
              onPrev={prev} onNext={next}
            />
          )}

          {/* 사진 */}
          {view.s === 'photos' && (
            <div className="card wiz-card">
              <p className="wiz-lead">{info.no} <b>회의 사진</b>을 넣어주세요. <b>최대 {MAX_PHOTOS}장</b>까지 넣을 수 있습니다.</p>
              <div className="img-grid">
                {(meeting.photos || []).map((src, i) => (
                  <div className="img-thumb sm" key={i}>
                    <img src={src} alt="" />
                    <button type="button" className="img-del" onClick={() => upd({ photos: meeting.photos.filter((_, x) => x !== i) })}>✕</button>
                  </div>
                ))}
                {(meeting.photos?.length || 0) < MAX_PHOTOS && (
                  <label className={`img-upload sm ${busy ? 'busy' : ''}`}>
                    {busy ? '불러오는 중…' : '＋ 사진 추가'}
                    <input type="file" accept="image/*" multiple hidden disabled={busy}
                      onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                  </label>
                )}
              </div>
              <p className="hint">사진이 없으면 그냥 넘어가셔도 됩니다.</p>
              {err && <p className="error">⚠️ {err}</p>}
              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next}>{info.no} 정리본 보기 →</button>
              </div>
            </div>
          )}

          {/* 이 차수 정리본 */}
          {view.s === 'done' && (
            <>
              <div className="card wiz-card">
                <p className="wiz-lead">
                  <b>{info.no} ({info.quarter}) 문서 정리본</b>입니다.
                  아래에 <b>{info.year}년 회칙 · 위원 명단 · 개최 공지문 · 회의록 · 결과 공지문</b>이 한 번에 들어 있습니다.
                </p>
                <h3 className="wiz-sub">{info.quarter} 운영의 특징</h3>
                <p className="hint">이 분기 회의가 어떤 점에서 의미 있었는지 한 문단으로 정리합니다.</p>
                <button className="primary" onClick={makeFeature} disabled={busy}>
                  {busy ? 'AI가 작성 중입니다…' : `✍️ ${meeting.feature ? '다시 ' : ''}특징 정리하기`}
                </button>
                {err && <p className="error">⚠️ {err}</p>}
                {meeting.feature && (
                  <>
                    <div className="wiz-result">
                      <div className="wiz-result-top">{info.quarter} 운영의 특징 <span>— 직접 고쳐도 됩니다</span></div>
                      <textarea rows={6} value={meeting.feature} onChange={(e) => upd({ feature: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                      <input type="text" value={meeting.featureFeedback} onChange={(e) => upd({ featureFeedback: e.target.value })} />
                    </div>
                    {meeting.featureFeedback?.trim() && (
                      <button className="ghost" onClick={makeFeature} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                    )}
                  </>
                )}
                {q < 3 ? (
                  <button className="next-doc" onClick={() => go({ v: 'step', q: q + 1, s: 'agenda' })}>
                    ✅ 확인했습니다 · {MEETINGS[q + 1].no} ({MEETINGS[q + 1].quarter}) 이어서 만들기 →
                  </button>
                ) : (
                  <button className="next-doc" onClick={() => go({ v: 'save' })}>
                    ✅ 네 차수 모두 끝 · 전체 문서 저장하기 →
                  </button>
                )}
                <div className="wiz-nav">
                  <button className="ghost" onClick={prev}>← 이전</button>
                  <button className="ghost" onClick={() => go({ v: 'pick' })}>차수 목록으로</button>
                </div>
              </div>
              <div className="page-outer">
                <div className="print-area">
                  <PrintSheet>
                    {buildOneMeetingDoc(data, q, basic || {}).map((b, i) => <Block key={i} b={b} />)}
                  </PrintSheet>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ───────── 저장 ───────── */}
      {view.v === 'save' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">운영위원회 · 문서 저장</div>
            <h1>문서 저장하기</h1>
          </div>
          <div className="card wiz-card">
            <p className="wiz-lead">회칙과 네 차수를 <b>한 문서</b>로 묶었습니다. <b>PDF</b>나 <b>한글(hwpx)</b>로 저장하세요.</p>
            {doneCount < 4 && (
              <p className="hint" style={{ color: '#b8860b' }}>
                ※ 지금 {doneCount}개 차수만 작성되어 있습니다. 심사에는 <b>분기별 1회, 연 4회</b>가 필요하니 나머지도 꼭 채워주세요.
              </p>
            )}
            <div className="wiz-saves">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (사진 포함)</button>
              <button className="ghost" onClick={saveHwpx} disabled={busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            {err && <p className="error">⚠️ {err}</p>}
            <p className="hint">
              PDF는 인쇄 대화상자에서 <b>대상을 PDF로 저장</b>으로 고르시면 됩니다.<br />
              한글 파일에는 <b>글자만</b> 들어갑니다. 사진은 PDF를 쓰시거나 한글에서 직접 붙여 넣어 주세요.
            </p>
            <div className="wiz-nav">
              <button className="ghost" onClick={() => go({ v: 'pick' })}>← 차수 목록으로</button>
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

// ── 해마다 다른 운영위원 명단 ──
function MemberCard({ year, members, onChange, onCopy }) {
  const set = (i, patch) => onChange(members.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const add = () => onChange([...members, { name: '', role: '학부모 대표' }]);
  const del = (i) => onChange(members.filter((_, n) => n !== i));
  const filled = members.filter((x) => x.name?.trim()).length;

  return (
    <div className="card wiz-card">
      <h2 className="wiz-sub">{year}년 운영위원 명단 <span className="wiz-sub-c">{filled}명</span></h2>
      <p className="hint">
        {year}년도 임기는 <b>{year}년 3월 1일 ~ {Number(year) + 1}년 2월 28일</b>입니다.
        원장 · 보육교사 대표 · 학부모 대표 · 지역사회 인사로 구성합니다.
      </p>
      <div className="mem-list">
        {members.map((x, i) => (
          <div className="mem-row" key={i}>
            <input type="text" value={x.name} placeholder="성명" onChange={(e) => set(i, { name: e.target.value })} />
            <select value={x.role} onChange={(e) => set(i, { role: e.target.value })}>
              {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="button" className="mem-del" onClick={() => del(i)}>✕</button>
          </div>
        ))}
      </div>
      <div className="mem-tools">
        <button type="button" className="ghost sm" onClick={add}>＋ 위원 추가</button>
        {onCopy && <button type="button" className="ghost sm" onClick={onCopy}>2025년 명단과 똑같이</button>}
      </div>
    </div>
  );
}

// 원장님이 가진 서식 붙여넣기 (한 번 넣으면 네 차수 모두 그 틀로)
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

// AI가 글을 쓰고 → 보여주고 → 고칠 곳을 받아 다시 쓰는 단계 (공지문 공통)
function AiStep({ lead, sampleLabel, sample, onSample, value, onChange, feedback, onFeedback, onMake, busy, err, makeLabel, nextLabel, onPrev, onNext }) {
  return (
    <div className="card wiz-card">
      <p className="wiz-lead">{lead}</p>
      {sampleLabel && <Sample label={sampleLabel} value={sample} onChange={onSample} />}
      <button className="primary" onClick={onMake} disabled={busy}>
        {busy ? 'AI가 작성 중입니다…' : `✍️ ${value ? '다시 ' : ''}${makeLabel}`}
      </button>
      {err && <p className="error">⚠️ {err}</p>}

      {value && (
        <>
          <div className="wiz-result">
            <div className="wiz-result-top">만들어진 글 <span>— 직접 고쳐도 됩니다</span></div>
            <textarea rows={14} value={value} onChange={(e) => onChange(e.target.value)} />
          </div>
          <div className="field">
            <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
            <input type="text" value={feedback} onChange={(e) => onFeedback(e.target.value)}
              placeholder="예) 좀 더 짧게, 부모 의견을 꼭 보내달라는 말을 넣어주세요" />
          </div>
          {feedback?.trim() && (
            <button className="ghost" onClick={onMake} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
          )}
        </>
      )}

      <div className="wiz-nav">
        <button className="ghost" onClick={onPrev}>← 이전</button>
        <button className="primary" onClick={onNext} disabled={!value}>{nextLabel}</button>
      </div>
    </div>
  );
}
