'use client';

// 운영위원회 "기존 서류 정리" — 원장님이 가진 파일을 올려 한 흐름으로 정리한다.
// 원장님이 정한 순서:
//   1차(2025년 4분기) → 2차(2026년 1분기) → 3차(2026년 2분기) → 4차(2026년 3분기) → 전체 문서
// 차수마다: 자료 올리기 → AI 분석 → 확인·수정 → 차수 정리본
// 회칙과 운영위원 명단은 연도별로 한 번만 (1차·2026년은 2차) 올리면 되고, 전체 문서도 그렇게 묶인다.
// 회의 사진은 넣지 않는다.

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import { extractTextFromFile } from '../lib/extract';
import {
  MEETINGS, MEMBER_ROLES, emptyData, emptyMeeting, suggestMembers,
  whenText, agendaList, meetingHasContent, meetingDone, membersOf, attendText,
  defaultRulesText, defaultOrder, qLabel, isFirstOfYear, yearDocAt, normalizeRules,
  buildCommitteeDoc, buildOneMeetingDoc, toHwpxBlocks,
} from '../lib/committeeDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'committee-tidy';

const STEPS = ['upload', 'analyze', 'check', 'done'];
const STEP_TITLE = {
  upload: '자료 올리기',
  analyze: '올린 자료 AI 분석하기',
  check: '분석 결과 확인·수정',
  done: '이 차수 정리본',
};

// 올린 파일 원문과 분석 상태를 함께 보관한다
const freshMeeting = () => ({
  ...emptyMeeting(),
  src: { notice: '', minutes: '', result: '', etc: '' },
  files: { notice: [], minutes: [], result: [], etc: [] },
  missing: [],
  analyzed: false,
});

// 예전에 저장된 것(파일 이름이 글자 하나였던 때)도 배열로 맞춘다
const fileList = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

const freshData = () => ({
  ...emptyData(),
  rulesSrc: { 2025: '', 2026: '' },
  rulesFile: { 2025: '', 2026: '' },
  meetings: MEETINGS.map(() => freshMeeting()),
});

// 올릴 자료 세 가지
const SRC_KINDS = [
  { k: 'notice', label: '운영위 회의 안내문 (개최 공지문)', hint: '회의 전에 부모님께 보낸 안내문' },
  { k: 'minutes', label: '회의록', hint: '회의 내용을 적어 둔 회의록' },
  { k: 'result', label: '결과보고서 (회의결과 안내문)', hint: '회의 후 부모님께 알린 결과' },
  { k: 'etc', label: '그 밖의 자료 (선택)', hint: '위원 위촉장·총회 자료·참석 서명지 등 참고할 문서' },
];

export default function CommitteeTidy({ onBack }) {
  const [data, setData] = useState(freshData());
  const [basic, setBasic] = useState(null);
  // view: {v:'pick'} | {v:'step', q, s} | {v:'save'}
  const [view, setView] = useState({ v: 'pick' });
  const [busy, setBusy] = useState('');
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
        setData({
          ...freshData(),
          ...saved,
          meetings: MEETINGS.map((_, i) => ({ ...freshMeeting(), ...(saved.meetings[i] || {}) })),
        });
        if (saved.view) setView(saved.view);
      } else {
        const m = suggestMembers(b);
        setData({ ...freshData(), members: { 2025: m, 2026: m.map((x) => ({ ...x })) } });
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

  // 어린이집 이름은 다른 서류와 함께 쓰도록 기본사항(basic-info)에 저장한다
  function setCenter(name) {
    setBasic((b) => {
      const nextBasic = { ...(b || {}), centerName: name };
      saveForm('basic-info', nextBasic);
      return nextBasic;
    });
  }
  const q = view.q ?? 0;
  const info = MEETINGS[q];
  const meeting = data.meetings[q] || freshMeeting();
  const year = info.year;
  const members = membersOf(data, q);
  const stepIdx = STEPS.indexOf(view.s);

  const go = (v) => { setErr(''); setSaveMsg(''); setView(v); window.scrollTo(0, 0); };
  const goStep = (s) => go({ v: 'step', q, s });
  const next = () => goStep(STEPS[Math.min(stepIdx + 1, STEPS.length - 1)]);
  const prev = () => (stepIdx <= 0 ? go({ v: 'pick' }) : goStep(STEPS[stepIdx - 1]));

  const upd = (patch) => setData((d) => ({
    ...d,
    meetings: d.meetings.map((m, i) => (i === q ? { ...m, ...patch } : m)),
  }));
  const setMembers = (y, list) => setData((d) => ({ ...d, members: { ...d.members, [y]: list } }));
  const setRules = (y, patch) => setData((d) => ({ ...d, rules: { ...d.rules, [y]: { ...d.rules[y], ...patch } } }));

  const doneCount = data.meetings.filter((m) => meetingDone(m)).length;

  function restart() {
    if (!window.confirm('올린 자료와 정리한 내용을 모두 지우고 처음부터 다시 할까요?\n\n지우면 되돌릴 수 없습니다.')) return;
    clearForm(KEY);
    setData(freshData());
    go({ v: 'pick' });
  }

  // ── 파일 올리기 → 글자 뽑기 (여러 개를 이어서 올릴 수 있다) ──
  async function pickSrc(kind, fileArr) {
    const files = Array.from(fileArr || []);
    if (!files.length) return;
    setErr('');
    setBusy(kind);
    try {
      let added = '';
      const names = [];
      for (const f of files) {
        const text = await extractTextFromFile(f);
        if (!text.trim()) throw new Error(`${f.name}에서 글자를 찾지 못했습니다.`);
        added += `${added ? '\n\n' : ''}[${f.name}]\n${text}`;
        names.push(f.name);
      }
      const before = meeting.src?.[kind] || '';
      upd({
        src: { ...meeting.src, [kind]: before ? `${before}\n\n${added}` : added },
        files: { ...meeting.files, [kind]: [...fileList(meeting.files?.[kind]), ...names] },
      });
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally {
      setBusy('');
    }
  }

  // 그 칸에 올린 자료 전부 비우기
  function clearSrc(kind) {
    upd({ src: { ...meeting.src, [kind]: '' }, files: { ...meeting.files, [kind]: [] } });
  }

  async function pickRules(file) {
    if (!file) return;
    setErr('');
    setBusy('rules');
    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error('파일에서 글자를 찾지 못했습니다.');
      // PDF·한글에서 뽑으면 줄바꿈이 사라지므로 장·조·항 앞에서 줄을 나눠 준다 (글자는 그대로)
      setData((d) => ({
        ...d,
        rulesSrc: { ...d.rulesSrc, [year]: text },
        rulesFile: { ...d.rulesFile, [year]: file.name },
        rules: { ...d.rules, [year]: { ...d.rules[year], text: normalizeRules(text) } },
      }));
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally {
      setBusy('');
    }
  }

  // 회칙은 기본자료를 먼저 넣어 두고, 고치고 싶은 부분만 고치게 한다 (원장님 방식)
  useEffect(() => {
    if (!loadedRef.current) return;
    if (view.v !== 'step' || view.s !== 'upload' || !isFirstOfYear(q)) return;
    if ((data.rules?.[year]?.text || '').trim()) return;
    setRules(year, { text: defaultRulesText(year, center || '○○어린이집') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.v, view.s, q, year, center]);

  // ── AI 부르기 ──
  async function ask(kind, extra = {}) {
    setBusy(kind);
    setErr('');
    try {
      const res = await fetch('/api/committee-tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          center,
          quarter: `${info.no} · ${qLabel(q)} (회계연도 ${year}년도, 예상 시기 ${info.when})`,
          when: whenText(meeting),
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
      setBusy('');
    }
  }

  // 회칙 줄 정리 (내용은 바꾸지 않음)
  async function tidyRules() {
    const j = await ask('rules', { rulesSrc: data.rulesSrc?.[year] || '' });
    if (j?.text) setRules(year, { text: j.text });
  }

  // 올린 자료 분석 → 문서 항목으로 나누어 채우기
  async function analyze(again = false) {
    const j = await ask('analyze', {
      noticeSrc: meeting.src.notice,
      minutesSrc: meeting.src.minutes,
      resultSrc: meeting.src.result,
      etcSrc: meeting.src.etc,
      ...(again && meeting.analyzeFeedback
        ? { previous: JSON.stringify({ agenda: meeting.agenda, discussion: meeting.discussion }), feedback: meeting.analyzeFeedback }
        : {}),
    });
    const r = j?.result;
    if (!r) return;

    // 명단은 그 해 명단이 비어 있을 때만 자동으로 채운다 (원장님이 고친 것을 덮지 않음)
    const found = Array.isArray(r.members)
      ? r.members.filter((x) => x?.name?.trim()).map((x) => ({
        name: String(x.name).trim(),
        role: MEMBER_ROLES.includes(x.role) ? x.role : '학부모 대표',
      }))
      : [];
    const cur = (data.members?.[year] || []).filter((x) => x.name?.trim());
    if (found.length && !cur.length) setMembers(year, found);

    upd({
      date: r.date || meeting.date,
      time: r.time || meeting.time,
      place: r.place || meeting.place,
      secretary: r.secretary || meeting.secretary,
      guests: r.guests || meeting.guests,
      absent: Array.isArray(r.absent) ? r.absent : [],
      agenda: r.agenda || meeting.agenda,
      noticeGreeting: r.noticeGreeting || '',
      noticeClosing: r.noticeClosing || '',
      order: r.order || defaultOrder({ ...meeting, agenda: r.agenda || meeting.agenda }),
      discussion: r.discussion || '',
      resultIntro: r.resultIntro || '',
      resultItems: Array.isArray(r.resultItems) ? r.resultItems : [],
      resultClosing: r.resultClosing || '',
      feature: r.feature || '',
      missing: Array.isArray(r.missing) ? r.missing : [],
      analyzed: true,
      analyzeFeedback: '',
    });
  }

  // ── 저장 ──
  const blocks = view.v === 'save'
    ? buildCommitteeDoc(data, basic || {})
    : buildOneMeetingDoc(data, q, basic || {});

  async function saveHwpx(only = null) {
    setBusy('hwpx');
    setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const src = only === null ? buildCommitteeDoc(data, basic || {}) : buildOneMeetingDoc(data, only, basic || {});
      const name = only === null
        ? `${center || '어린이집'}_운영위원회_서류정리.hwpx`
        : `${center || '어린이집'}_운영위원회_${MEETINGS[only].no}_${MEETINGS[only].quarter}.hwpx`;
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(src), onProgress: setSaveMsg });
      downloadBlob(blob, name);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally {
      setBusy('');
    }
  }

  const hasAnySrc = SRC_KINDS.some(({ k }) => meeting.src?.[k]?.trim());
  const firstOfYear = isFirstOfYear(q);
  const yearDoc = yearDocAt(q);

  // 위원 명단 표 (그 해)
  // 주의: 컴포넌트 태그로 쓰면 한 글자 칠 때마다 칸이 새로 만들어져 한글 입력이 깨진다.
  //       반드시 {memberTable()} 처럼 함수로 불러 쓴다.
  const memberTable = () => (
    <div className="tidy-members">
      {(data.members?.[year] || []).map((mem, i) => (
        <div className="tidy-member" key={i}>
          <input
            type="text" value={mem.name} placeholder="이름"
            onChange={(e) => setMembers(year, data.members[year].map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))}
          />
          <select
            value={mem.role}
            onChange={(e) => setMembers(year, data.members[year].map((x, n) => (n === i ? { ...x, role: e.target.value } : x)))}
          >
            {MEMBER_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button type="button" onClick={() => setMembers(year, data.members[year].filter((_, n) => n !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="ghost sm" onClick={() => setMembers(year, [...(data.members[year] || []), { name: '', role: '학부모 대표' }])}>
        ＋ 위원 추가
      </button>
    </div>
  );

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 문서 목록으로</button>

      {/* ───────── 차수 고르기 ───────── */}
      {view.v === 'pick' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">운영위원회 서류 정리</div>
            <h1>차수별 서류 정리하기</h1>
          </div>

          <div className="card wiz-card">
            <p className="wiz-lead">
              차수를 골라 <b>가지고 있는 자료를 올리면</b> AI가 읽어서 정리합니다. <b>1차부터</b> 차례로 하시면 됩니다.
            </p>

            <div className="q-grid">
              {MEETINGS.map((mi, i) => {
                const m = data.meetings[i];
                const ok = meetingDone(m);
                const some = meetingHasContent(m) || SRC_KINDS.some(({ k }) => m.src?.[k]);
                return (
                  <button key={i} className={`q-card ${ok ? 'done' : ''}`} onClick={() => go({ v: 'step', q: i, s: 'upload' })}>
                    <div className="q-top">
                      <b>{mi.no}</b>
                      <span className={`q-chip ${ok ? 'ok' : ''}`}>{ok ? '완성' : some ? '작성 중' : '아직'}</span>
                    </div>
                    <div className="q-when">{mi.quarter}</div>
                    {m.date ? <div className="q-date">{whenText(m)}</div> : <div className="q-date">{mi.when}</div>}
                  </button>
                );
              })}
            </div>

            <p className="hint">{doneCount}/4 차수를 정리했습니다.</p>
            <button className="next-doc" onClick={() => go({ v: 'save' })}>
              📚 전체 문서 다운받기 (1~4차 한 권으로) →
            </button>

            <div className="field" style={{ marginTop: 18 }}>
              <label>어린이집 이름 <span className="req">*</span></label>
              <input type="text" value={center} placeholder="예) 멘토어린이집" onChange={(e) => setCenter(e.target.value)} />
              {!center && <p className="hint" style={{ color: '#b4661a' }}>⚠️ 이름을 넣으면 모든 문서 제목과 회칙에 자동으로 들어갑니다.</p>}
            </div>
            <p className="hint">
              📌 <b>회칙과 운영위원 명단은 연도별로 한 번만</b> 올리면 됩니다 —
              2025년도는 <b>1차</b>, 2026년도는 <b>2차</b>에 올리면 전체 문서에도 한 번씩만 들어갑니다.
            </p>
            <p className="hint">🖼️ 운영위원회 자료에는 <b>사진이 필요하지 않습니다.</b></p>
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

          {err && <p className="error">⚠️ {err}</p>}

          {/* 1. 자료 올리기 */}
          {view.s === 'upload' && (
            <div className="card wiz-card">
              <p className="wiz-lead">
                <b>{info.no} ({info.quarter})</b> 자료를 올려 주세요. 실제 회의는 <b>{info.when}</b>에 열린 것입니다.
              </p>
              <p className="hint">한글(hwpx) · 워드(docx) · PDF · 텍스트 파일을 올릴 수 있습니다. 올린 내용은 아래에서 눈으로 확인하고 고칠 수 있어요.</p>

              <div className="tidy-sec">
                <h4>회의를 연 날 <span className="tidy-once">달력에서 고르세요</span></h4>
                <p className="hint">비워 두어도 됩니다. 올린 회의록에서 날짜를 찾아 자동으로 채워 드립니다.</p>
                <div className="sched-row">
                  <div className="sched-tag">
                    <b>{info.no}</b>
                    <span>{info.quarter}</span>
                    <em>{info.when}</em>
                    {info.note && <i>※ {info.note}</i>}
                  </div>
                  <div className="sched-inputs">
                    <input type="date" value={meeting.date} onChange={(e) => upd({ date: e.target.value })} />
                    <input type="text" value={meeting.time} placeholder="예) 오후 5시" onChange={(e) => upd({ time: e.target.value })} />
                    <input type="text" value={meeting.place} placeholder="장소" onChange={(e) => upd({ place: e.target.value })} />
                  </div>
                </div>
              </div>

              {firstOfYear ? (
                <>
                  <div className="tidy-sec">
                    <h4>① {year}년 운영위원회 회칙 <span className="tidy-once">연도별 1회</span></h4>
                    <p className="hint">
                      <b>기본 회칙을 미리 넣어 두었습니다.</b> 위원 정수·임기 날짜·어린이집 이름은 <b>{year}년에 맞춰 자동</b>으로 들어갑니다.
                      아래에서 <b>고치고 싶은 부분만</b> 고치세요.
                    </p>
                    <div className="wiz-result-top">
                      <span>{year}년 회칙 전문</span>
                      <span className="edit-badge">✏️ 고치고 싶은 부분만 고치세요</span>
                    </div>
                    <textarea rows={14} value={data.rules?.[year]?.text || ''} onChange={(e) => setRules(year, { text: e.target.value })} />
                    <button type="button" className="ghost sm" onClick={() => setRules(year, { text: defaultRulesText(year, center || '○○어린이집') })}>
                      기본 회칙으로 되돌리기
                    </button>

                    <details className="tidy-peek" style={{ marginTop: 10 }}>
                      <summary>우리 원 회칙 파일이 따로 있으면 올리기 (선택)</summary>
                      <p className="hint">
                        회칙은 법령에 따른 문서라 <b>AI가 내용을 지어내지 않습니다.</b> 올린 원문을 그대로 쓰고 줄만 정리합니다.
                        ⚠️ 올리면 위 기본 회칙을 <b>덮어씁니다.</b>
                      </p>
                      <label className="file-btn">
                        {busy === 'rules' ? '읽는 중…' : (data.rulesFile?.[year] ? '📎 다른 파일로 바꾸기' : '📎 회칙 파일 올리기 (PDF·한글)')}
                        <input type="file" accept=".hwpx,.docx,.pdf,.txt" hidden disabled={!!busy}
                          onChange={(e) => { pickRules(e.target.files[0]); e.target.value = ''; }} />
                      </label>
                      {data.rulesFile?.[year] && <span className="tidy-file">✔ {data.rulesFile[year]}</span>}
                      {data.rulesFile?.[year] && (
                        <button className="ghost sm" style={{ marginTop: 8 }} onClick={tidyRules} disabled={!!busy}>
                          {busy === 'rules' ? '정리 중…' : '🧹 줄이 안 맞으면 AI로 줄 정리 (내용은 그대로)'}
                        </button>
                      )}
                    </details>
                  </div>

                  <div className="tidy-sec">
                    <h4>② {year}년 운영위원 명단 <span className="tidy-once">연도별 1회</span></h4>
                    <p className="hint">회의록을 올려 <b>AI 분석</b>을 하면 명단이 자동으로 들어옵니다. 여기서 직접 고쳐도 됩니다.</p>
                    {memberTable()}
                  </div>
                </>
              ) : (
                <p className="tidy-note">
                  ※ {year}년도 <b>회칙과 운영위원 명단</b>은 <b>{yearDoc.no}({yearDoc.quarter})</b>에서 이미 올렸습니다.
                  이 차수에서는 <b>회의 자료만</b> 올리시면 됩니다. (전체 문서에도 연도별로 한 번씩만 들어갑니다)
                </p>
              )}

              <div className="tidy-sec">
                <h4>{firstOfYear ? '③' : '①'} 이번 차수 회의 자료</h4>
                {SRC_KINDS.map(({ k, label, hint }, n) => {
                  const names = fileList(meeting.files?.[k]);
                  return (
                    <div className="tidy-src" key={k}>
                      <div className="tidy-src-top">
                        <b>{(firstOfYear ? n + 3 : n + 1)}. {label}</b>
                        <span className="hint">{hint}</span>
                      </div>
                      <label className="file-btn">
                        {busy === k ? '읽는 중…' : (names.length ? '📎 파일 더 올리기' : `📎 ${label} 올리기`)}
                        <input type="file" accept=".hwpx,.docx,.pdf,.txt" multiple hidden disabled={!!busy}
                          onChange={(e) => { pickSrc(k, e.target.files); e.target.value = ''; }} />
                      </label>
                      {names.length > 0 && (
                        <>
                          <span className="tidy-file">✔ {names.join(' · ')}</span>
                          <button type="button" className="ghost sm" style={{ marginLeft: 8 }} onClick={() => clearSrc(k)}>비우기</button>
                        </>
                      )}
                      {meeting.src?.[k] && (
                        <details className="tidy-peek">
                          <summary>올린 내용 보기 · 고치기 ({meeting.src[k].length.toLocaleString()}자)</summary>
                          <textarea rows={8} value={meeting.src[k]}
                            onChange={(e) => upd({ src: { ...meeting.src, [k]: e.target.value } })} />
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 차수 목록</button>
                <button className="primary" onClick={next} disabled={!hasAnySrc}>다음 · AI로 분석하기 →</button>
              </div>
              {!hasAnySrc && <p className="hint">자료를 하나라도 올리면 다음으로 넘어갈 수 있습니다.</p>}
            </div>
          )}

          {/* 2. AI 분석 */}
          {view.s === 'analyze' && (
            <div className="card wiz-card">
              <p className="wiz-lead">올린 자료를 AI가 읽어서 <b>일시·참석자·안건·공지문·회의록·결과서</b> 항목으로 나눠 정리합니다.</p>
              <p className="hint">자료에 없는 내용은 <b>지어내지 않고 비워 두고</b>, 무엇이 없었는지 알려드립니다.</p>

              <button className="primary" onClick={() => analyze(false)} disabled={!!busy}>
                {busy === 'analyze' ? 'AI가 분석 중입니다…' : `🤖 ${meeting.analyzed ? '다시 ' : ''}이번 자료 분석하기`}
              </button>

              {meeting.analyzed && (
                <>
                  <div className="tidy-sum">
                    <h4>읽어낸 내용</h4>
                    <table className="doc-kv">
                      <tbody>
                        <tr><th>회의 일시</th><td>{whenText(meeting) || '— (자료에서 못 찾음)'}</td></tr>
                        <tr><th>장소</th><td>{meeting.place || '—'}</td></tr>
                        <tr><th>간사</th><td>{meeting.secretary || '—'}</td></tr>
                        <tr><th>참석자</th><td>{attendText(members, meeting) || '—'}</td></tr>
                        <tr><th>안건</th><td>{agendaList(meeting).map((t, i) => `${i + 1}. ${t}`).join('\n') || '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {(meeting.missing || []).length > 0 && (
                    <div className="tidy-missing">
                      <h4>⚠️ 자료에서 찾지 못해 비워 둔 것</h4>
                      <ul>{meeting.missing.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      <p className="hint">다음 단계에서 직접 채워 넣으시면 됩니다.</p>
                    </div>
                  )}

                  <div className="field" style={{ marginTop: 14 }}>
                    <label>고칠 부분이 있으면 적어주세요 (다시 분석합니다)</label>
                    <textarea rows={3} value={meeting.analyzeFeedback || ''} placeholder="예) 참석자에 지역위원 김○○을 넣어주세요. 안건 2번은 급식 운영이 아니라 안전점검입니다."
                      onChange={(e) => upd({ analyzeFeedback: e.target.value })} />
                    <button className="ghost" onClick={() => analyze(true)} disabled={!!busy || !meeting.analyzeFeedback?.trim()}>
                      ↻ 고쳐서 다시 분석하기
                    </button>
                  </div>
                </>
              )}

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next} disabled={!meeting.analyzed}>다음 · 확인하고 고치기 →</button>
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
                <h4>회의 기본 정보</h4>
                <div className="wiz-2col">
                  <div className="field">
                    <label>회의 날짜</label>
                    <input type="date" value={meeting.date} onChange={(e) => upd({ date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>시각</label>
                    <input type="text" value={meeting.time} placeholder="예) 오후 5시" onChange={(e) => upd({ time: e.target.value })} />
                  </div>
                </div>
                <div className="wiz-2col">
                  <div className="field">
                    <label>장소</label>
                    <input type="text" value={meeting.place} onChange={(e) => upd({ place: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>간사</label>
                    <input type="text" value={meeting.secretary} onChange={(e) => upd({ secretary: e.target.value })} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>그 밖의 참석자 (선택)</label>
                    <input type="text" value={meeting.guests} placeholder="예) 참관 학부모 1명" onChange={(e) => upd({ guests: e.target.value })} />
                  </div>
                  <div className="field" />
                </div>
              </div>

              <div className="tidy-sec">
                <h4>참석한 위원 <span className="tidy-once">{year}년 명단 {firstOfYear ? '· 연도별 1회' : `· ${yearDoc.no}에서 올린 명단`}</span></h4>
                {members.length === 0 ? (
                  <p className="hint">위원 명단이 비어 있습니다. 아래 <b>명단 고치기</b>에서 넣어 주세요.</p>
                ) : (
                  <>
                    <p className="hint">참석한 위원만 켜 두세요. 끈 위원은 회의록 참석현황에서 빠집니다.</p>
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
                  </>
                )}
                <details className="tidy-peek" style={{ marginTop: 10 }}>
                  <summary>명단 고치기 (이름·구분 바꾸기 · 위원 추가)</summary>
                  <div style={{ marginTop: 8 }}>{memberTable()}</div>
                </details>
              </div>

              <div className="tidy-sec">
                <h4>안건 <span className="edit-badge">✏️ 올린 회의록에서 가져왔습니다 · 고쳐도 됩니다</span></h4>
                <p className="hint">한 줄에 하나씩. 번호는 문서에서 자동으로 붙습니다.</p>
                <textarea rows={5} value={meeting.agenda} onChange={(e) => upd({ agenda: e.target.value })} />
              </div>

              <div className="tidy-sec">
                <h4>① 개최 공지문</h4>
                <div className="field">
                  <label>인사말</label>
                  <textarea rows={5} value={meeting.noticeGreeting} onChange={(e) => upd({ noticeGreeting: e.target.value })} />
                </div>
                <div className="field">
                  <label>맺음말</label>
                  <textarea rows={3} value={meeting.noticeClosing} onChange={(e) => upd({ noticeClosing: e.target.value })} />
                </div>
              </div>

              <div className="tidy-sec">
                <h4>② 회의록</h4>
                <div className="field">
                  <label>회의순서</label>
                  <textarea rows={6} value={meeting.order} onChange={(e) => upd({ order: e.target.value })} />
                </div>
                <div className="field">
                  <label>토의 및 의결사항</label>
                  <textarea rows={14} value={meeting.discussion} onChange={(e) => upd({ discussion: e.target.value })} />
                </div>
              </div>

              <div className="tidy-sec">
                <h4>③ 회의결과 안내문</h4>
                <div className="field">
                  <label>머리말</label>
                  <textarea rows={3} value={meeting.resultIntro} onChange={(e) => upd({ resultIntro: e.target.value })} />
                </div>
                {(meeting.resultItems || []).map((it, i) => (
                  <div className="tidy-item" key={i}>
                    <input type="text" value={it.title} placeholder="안건 이름"
                      onChange={(e) => upd({ resultItems: meeting.resultItems.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)) })} />
                    <textarea rows={5} value={it.body}
                      onChange={(e) => upd({ resultItems: meeting.resultItems.map((x, n) => (n === i ? { ...x, body: e.target.value } : x)) })} />
                    <button type="button" className="ghost sm" onClick={() => upd({ resultItems: meeting.resultItems.filter((_, n) => n !== i) })}>
                      이 안건 지우기
                    </button>
                  </div>
                ))}
                <button type="button" className="ghost sm" onClick={() => upd({ resultItems: [...(meeting.resultItems || []), { title: '', body: '' }] })}>
                  ＋ 안건 추가
                </button>
                <div className="field" style={{ marginTop: 10 }}>
                  <label>맺음말 (감사 인사)</label>
                  <textarea rows={4} value={meeting.resultClosing} onChange={(e) => upd({ resultClosing: e.target.value })} />
                </div>
              </div>

              <div className="tidy-sec">
                <h4>④ {info.qn}분기 운영위 내용정리</h4>
                <textarea rows={5} value={meeting.feature} onChange={(e) => upd({ feature: e.target.value })} />
              </div>

              <div className="wiz-nav">
                <button className="ghost" onClick={prev}>← 이전</button>
                <button className="primary" onClick={next}>다음 · 정리본 보기 →</button>
              </div>
            </div>
          )}

          {/* 4. 차수 정리본 */}
          {view.s === 'done' && (
            <>
              <div className="card wiz-card">
                <p className="wiz-lead">
                  <b>{info.no} ({info.quarter})</b> 정리본입니다. 아래에서 확인하고, 이 차수만 따로 저장할 수도 있습니다.
                </p>
                {firstOfYear
                  ? <p className="hint">이 문서에는 <b>{year}년도 구성계획·회칙</b>이 함께 들어 있습니다. (연도별 1회)</p>
                  : <p className="hint">{year}년도 구성계획·회칙은 <b>{yearDoc.no}</b> 문서에 들어 있습니다.</p>}
                <div className="wiz-nav">
                  <button className="primary" onClick={() => window.print()}>🖨️ {info.no}만 PDF로 저장</button>
                  <button className="ghost" onClick={() => saveHwpx(q)} disabled={!!busy}>📄 {info.no}만 한글(hwpx)로 저장</button>
                </div>
                {saveMsg && <p className="hint">{saveMsg}</p>}

                {q < MEETINGS.length - 1 ? (
                  <button className="next-doc" onClick={() => go({ v: 'step', q: q + 1, s: 'upload' })}>
                    ✅ 확인했습니다 · {MEETINGS[q + 1].no}({MEETINGS[q + 1].quarter}) 이어서 정리하기 →
                  </button>
                ) : (
                  <button className="next-doc" onClick={() => go({ v: 'save' })}>
                    📚 네 차수 다 됐습니다 · 전체 문서 다운받기 →
                  </button>
                )}
                <div className="wiz-nav">
                  <button className="ghost" onClick={prev}>← 이전</button>
                  <button className="ghost" onClick={() => go({ v: 'pick' })}>차수 목록</button>
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

      {/* ───────── 전체 문서 ───────── */}
      {view.v === 'save' && (
        <>
          <div className="wiz-head">
            <div className="wiz-count">운영위원회 서류 정리 · 마지막</div>
            <h1>전체 문서 다운받기</h1>
          </div>

          <div className="card wiz-card">
            <p className="wiz-lead">
              정리한 차수를 <b>1차 → 2차 → 3차 → 4차</b> 순서로 한 권으로 묶었습니다.
            </p>
            <p className="hint">
              📌 <b>회칙과 운영위원 명단</b>은 <b>1차(2025년도)</b>와 <b>2차(2026년도)</b> 문서에만 한 번씩 들어갑니다.
              3·4차에는 &quot;{'앞 차수 문서에 있습니다'}&quot;라는 안내만 들어갑니다.
            </p>
            {doneCount < 4 && (
              <p className="hint" style={{ color: '#b4661a' }}>
                ⚠️ 아직 {4 - doneCount}개 차수가 덜 정리됐습니다. 지금까지 정리한 것만으로도 저장할 수 있어요.
              </p>
            )}
            {err && <p className="error">⚠️ {err}</p>}
            <div className="wiz-nav">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (또는 인쇄)</button>
              <button className="ghost" onClick={() => saveHwpx()} disabled={!!busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            <div className="wiz-nav">
              <button className="ghost" onClick={() => go({ v: 'pick' })}>← 차수 목록으로</button>
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
