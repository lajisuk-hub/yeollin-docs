'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import { fileToResizedDataURL } from '../lib/image';
import { buildCounselDoc, toHwpxBlocks, emptyRound, periodText, roundHasContent, noticeBlock, applyBlock, defaultNoticeItems, DEFAULT_BG, DEFAULT_BG_PLAIN, DEFAULT_APPLY_BG, noticeBgFor, applyBgFor, noticeBottomFor, applyBottomFor } from '../lib/counselDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'counsel-wizard';
const MAX_PHOTOS = 4;

// 단계 구성: 안내 → (회차마다 시기·공지문·신청서·상담결과·사진·정리) ×2 → 저장
const STEPS = [
  { id: 'intro' },
  ...[0, 1].flatMap((r) => [
    { id: 'period', r }, { id: 'notice', r }, { id: 'apply', r },
    { id: 'result', r }, { id: 'photos', r }, { id: 'roundend', r },
  ]),
  { id: 'save' },
];

// 회차 기본 서식 (2회차는 1회차와 구분되도록 다른 색 서식)
const freshRound = (i) => ({
  ...emptyRound(),
  noticeBg: noticeBgFor(i), applyBg: applyBgFor(i),
  noticeBottom: noticeBottomFor(i), applyBottom: applyBottomFor(i),
});

// 예전에 저장해 둔 2회차는 1회차와 똑같은 서식이었다 → 새 2회차 서식으로 자동 교체.
// (원장님이 직접 올린 그림은 그대로 둔다)
const OLD_NOTICE_BGS = [DEFAULT_BG, DEFAULT_BG_PLAIN];
function upgradeBg(x, i) {
  if (i !== 1 || !x) return x;
  const y = { ...x };
  if (OLD_NOTICE_BGS.includes(y.noticeBg)) { y.noticeBg = noticeBgFor(1); y.noticeBottom = noticeBottomFor(1); }
  if (y.applyBg === DEFAULT_APPLY_BG) { y.applyBg = applyBgFor(1); y.applyBottom = applyBottomFor(1); }
  return y;
}

export default function CounselWizard({ onBack }) {
  const [data, setData] = useState({ rounds: [freshRound(0), freshRound(1)] });
  const [step, setStep] = useState(0);
  const [basic, setBasic] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const loadedRef = useRef(false);
  const timer = useRef(null);
  const posterRef = useRef(null);
  const applyRef = useRef(null);

  // ── 불러오기 / 자동 저장 ──
  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info')]).then(([saved, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (saved?.rounds) {
        // 아직 아무것도 안 쓴 회차는 지금의 기본값(글자 크기·여백)으로 새로 시작한다
        const merge = (x, i) => upgradeBg(roundHasContent(x) ? { ...freshRound(i), ...x } : freshRound(i), i);
        setData({ rounds: [merge(saved.rounds[0], 0), merge(saved.rounds[1], 1)] });
        if (typeof saved.step === 'number') setStep(saved.step);
      }
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveForm(KEY, { ...data, step }); }, 600);
    return () => clearTimeout(timer.current);
  }, [data, step]);

  const cur = STEPS[step];
  const r = cur.r ?? 0;
  const round = data.rounds[r];
  const center = basic?.centerName?.trim() || '';
  const classText = (basic?.staff || [])
    .flatMap((s) => (s.classes || []).map((c) => `${c.className || '반'}(${c.age || ''}, ${c.children?.length || c.count || 0}명)`))
    .join(' / ');

  const upd = (patch) => setData((p) => {
    const rounds = p.rounds.slice();
    rounds[r] = { ...rounds[r], ...patch };
    return { ...p, rounds };
  });

  const go = (n) => { setErr(''); setStep(n); window.scrollTo(0, 0); };
  const next = () => go(Math.min(step + 1, STEPS.length - 1));
  const prev = () => go(Math.max(step - 1, 0));

  async function askAi(kind, field, feedbackField) {
    setErr('');
    setBusy(true);
    try {
      const feedback = round[feedbackField]?.trim();
      const res = await fetch('/api/counsel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, center, classes: classText,
          round: `${r + 1}회차`,
          period: periodText(round),
          method: round.method, place: round.place,
          count: round.count, memo: round.memo,
          previous: feedback ? round[field] : '',
          feedback: feedback || '',
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'AI 작성에 실패했습니다');
      upd({ [field]: d.text, [feedbackField]: '' });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 안내문(가정통신문) 만들기 — 인사말·참고사항은 AI, 안내 항목은 상담 정보로 자동
  async function makeNotice() {
    setErr('');
    setBusy(true);
    try {
      const feedback = round.noticeFeedback?.trim();
      const res = await fetch('/api/counsel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'notice', center, classes: classText,
          round: `${r + 1}회차`, period: periodText(round),
          method: round.method, place: round.place,
          previous: feedback ? `${round.noticeGreeting}\n${round.noticeNotes}` : '',
          feedback: feedback || '',
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'AI 작성에 실패했습니다');
      upd({
        noticeEyebrow: d.result?.eyebrow || '함께 이야기하고, 함께 성장합니다',
        noticeGreeting: d.result?.greeting || '',
        noticeQuestions: (d.result?.questions || []).join('\n'),
        noticeNotes: (d.result?.notes || []).join('\n'),
        noticeItems: round.noticeItems?.trim() || defaultNoticeItems(round),
        noticeFeedback: '',
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 신청서 문구·항목 만들기
  async function makeApply() {
    setErr('');
    setBusy(true);
    try {
      const feedback = round.applyFeedback?.trim();
      const res = await fetch('/api/counsel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'apply', center, classes: classText,
          round: `${r + 1}회차`, period: periodText(round),
          method: round.method, place: round.place,
          previous: feedback ? `${round.applyIntro}\n${round.applyTopics}` : '',
          feedback: feedback || '',
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'AI 작성에 실패했습니다');
      upd({
        applyIntro: d.result?.intro || '',
        applyTopics: (d.result?.topics || []).join('\n'),
        applyFeedback: '',
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 서식 그림 올리기 (안내문 noticeBg / 신청서 applyBg)
  async function pickBg(file, key = 'noticeBg') {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      upd({ [key]: await fileToResizedDataURL(file, 1400) });
    } catch {
      setErr('그림을 불러오지 못했습니다. 다른 그림으로 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  // 화면에 보이는 서식을 그림 파일로 저장 (밴드·카톡에 올리거나 한글에 붙여넣기 좋게)
  async function saveImage(ref, name) {
    setBusy(true);
    setErr('');
    setSaveMsg('그림으로 만드는 중입니다…');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const el = ref.current?.firstChild;
      if (!el) throw new Error('서식을 찾지 못했습니다');
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const { downloadBlob } = await import('../lib/hwpx');
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      downloadBlob(blob, `${center || '어린이집'}_${name}.jpg`);
      setSaveMsg('그림 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '그림으로 만들지 못했습니다');
      setSaveMsg('');
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    setErr('');
    try {
      const room = MAX_PHOTOS - (round.photos?.length || 0);
      const urls = await Promise.all(files.slice(0, room).map((f) => fileToResizedDataURL(f)));
      upd({ photos: [...(round.photos || []), ...urls] });
    } catch {
      setErr('사진을 불러오지 못했습니다. 다른 사진으로 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function saveHwpx() {
    setBusy(true);
    setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_부모개별상담_성과정리.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    if (!window.confirm('상담 서류에 작성한 내용을 모두 지우고 처음부터 다시 할까요?')) return;
    clearForm(KEY);
    setData({ rounds: [emptyRound(), emptyRound()] });
    go(0);
  }

  const blocks = buildCounselDoc(data, basic || {});
  const roundBlocksOnly = (() => {
    const one = { rounds: [data.rounds[r]] };
    return buildCounselDoc(one, basic || {});
  })();

  // ── 단계별 화면 ──
  const title = {
    intro: '부모개별상담 서류 만들기',
    period: `${r + 1}회차 상담은 언제 하셨나요?`,
    notice: `${r + 1}회차 부모상담 공지문 만들기`,
    apply: `${r + 1}회차 부모상담 신청서 만들기`,
    result: `${r + 1}회차 상담 실시 내용 정리`,
    photos: `${r + 1}회차 상담 사진 넣기`,
    roundend: `${r + 1}회차 서류가 완성되었습니다`,
    save: '문서 저장하기',
  }[cur.id];

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 새로 만들 서류 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-bar"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="wiz-count">{step + 1} / {STEPS.length} 단계{cur.r !== undefined ? ` · ${r + 1}회차` : ''}</div>
        <h1>{title}</h1>
      </div>

      {/* 0. 안내 */}
      {cur.id === 'intro' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            <b>{center || '우리 어린이집'}</b>의 부모개별상담 결과 정리를 만듭니다.<br />
            열린어린이집 심사에서는 <b>상·하반기 각 1회, 연 2회</b> 상담 자료가 필요합니다.
          </p>
          <ul className="wiz-steps">
            <li><b>1회차</b> 상담 시기 → 공지문 → 신청서 → 상담 내용 → 사진</li>
            <li><b>2회차</b> 같은 순서로 한 번 더</li>
            <li>마지막에 <b>1·2회차를 한 문서로</b> PDF·한글로 저장</li>
          </ul>
          <p className="hint">한 단계씩 물어보는 대로만 답하시면 됩니다. 중간에 창을 닫아도 <b>여기까지 한 내용은 저장</b>됩니다.</p>
          {!center && <p className="error">⚠️ 기본사항에 어린이집 이름이 없습니다. 먼저 등록하시면 문서에 자동으로 들어갑니다.</p>}
          <button className="primary wiz-next" onClick={next}>시작하기 →</button>
        </div>
      )}

      {/* 1. 시기 */}
      {cur.id === 'period' && (
        <div className="card wiz-card">
          <p className="wiz-lead">{r + 1}회차 부모상담을 <b>진행한 기간</b>을 달력에서 골라주세요.</p>
          <div className="wiz-2col">
            <div className="field">
              <label>시작일 <span className="req">*</span></label>
              <input type="date" value={round.from} onChange={(e) => upd({ from: e.target.value })} />
            </div>
            <div className="field">
              <label>종료일</label>
              <input type="date" value={round.to} onChange={(e) => upd({ to: e.target.value })} />
            </div>
          </div>
          <div className="wiz-2col">
            <div className="field">
              <label>상담 방법</label>
              <select value={round.method} onChange={(e) => upd({ method: e.target.value })}>
                {['대면 상담', '전화 상담', '대면·전화 병행'].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>상담 장소</label>
              <input type="text" value={round.place} onChange={(e) => upd({ place: e.target.value })} placeholder="예) 어린이집 상담실" />
            </div>
          </div>
          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next} disabled={!round.from}>다음 · 공지문 만들기 →</button>
          </div>
        </div>
      )}

      {/* 2. 공지문 (가정통신문 형태) */}
      {cur.id === 'notice' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">어린이집 이름과 상담 기간으로 <b>부모님께 나눠드릴 가정통신문</b>을 만들어 드릴게요.</p>
            <button className="primary" onClick={makeNotice} disabled={busy}>
              {busy ? 'AI가 작성 중입니다…' : `✍️ ${round.noticeGreeting ? '다시 ' : ''}안내문 만들기`}
            </button>
            {err && <p className="error">⚠️ {err}</p>}

            {round.noticeGreeting && (
              <>
                <div className="field" style={{ marginTop: 16 }}>
                  <label>맨 위 한 줄 문구</label>
                  <input type="text" value={round.noticeEyebrow} onChange={(e) => upd({ noticeEyebrow: e.target.value })} placeholder="예) 함께 이야기하고, 함께 성장합니다" />
                </div>
                <div className="field">
                  <label>인사말</label>
                  <textarea rows={4} value={round.noticeGreeting} onChange={(e) => upd({ noticeGreeting: e.target.value })} />
                </div>
                <div className="field">
                  <label>상담 안내 <span className="fhint">(한 줄에 하나씩 · <b>제목 : 내용</b> 형태로 쓰면 아이콘이 붙어요)</span></label>
                  <textarea rows={5} value={round.noticeItems} onChange={(e) => upd({ noticeItems: e.target.value })} />
                </div>
                <div className="field">
                  <label>상담 전 생각해 올 질문 <span className="fhint">(한 줄에 하나씩 · 번호는 자동)</span></label>
                  <textarea rows={4} value={round.noticeQuestions} onChange={(e) => upd({ noticeQuestions: e.target.value })} />
                </div>
                <div className="field">
                  <label>부탁 말씀 <span className="fhint">(한 줄에 하나씩 · ※ 표시로 들어갑니다)</span></label>
                  <textarea rows={2} value={round.noticeNotes} onChange={(e) => upd({ noticeNotes: e.target.value })} />
                </div>
                <div className="field">
                  <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                  <input type="text" value={round.noticeFeedback} onChange={(e) => upd({ noticeFeedback: e.target.value })}
                    placeholder="예) 상담 시간이 20분이라는 것과 전화상담도 된다는 것을 넣어주세요" />
                </div>
                {round.noticeFeedback?.trim() && (
                  <button className="ghost" onClick={makeNotice} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                )}
              </>
            )}

            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="primary" onClick={next} disabled={!round.noticeGreeting}>확인 · 신청서 만들기 →</button>
            </div>
          </div>

          {round.noticeGreeting && (
            <div className="card wiz-card">
              <h3 className="card-title">이렇게 나옵니다 — 그대로 인쇄해서 나눠주세요</h3>

              <div className="bg-tools">
                <div className="bg-row">
                  <span className="bg-label">서식 그림</span>
                  <label className="file-btn sm">
                    🖼️ 내 그림 올리기
                    <input type="file" accept="image/*" hidden onChange={(e) => { pickBg(e.target.files[0]); e.target.value = ''; }} />
                  </label>
                  <button className="bg-btn" onClick={() => upd({ noticeBg: noticeBgFor(r), noticeBottom: noticeBottomFor(r) })}>기본 서식</button>
                  <button className="bg-btn" onClick={() => upd({ noticeBg: '' })}>그림 없이</button>
                </div>
                {round.noticeBg && (
                  <div className="bg-row sliders">
                    <label>글 시작 위치
                      <input type="range" min="20" max="55" value={round.noticeTop ?? 33} onChange={(e) => upd({ noticeTop: Number(e.target.value) })} />
                      <b>{round.noticeTop ?? 33}%</b>
                    </label>
                    <label>아래 여백
                      <input type="range" min="8" max="35" value={round.noticeBottom ?? 17} onChange={(e) => upd({ noticeBottom: Number(e.target.value) })} />
                      <b>{round.noticeBottom ?? 17}%</b>
                    </label>
                    <label>글자 크기
                      <input type="range" min="0.7" max="2" step="0.05" value={round.noticeScale ?? 1.15} onChange={(e) => upd({ noticeScale: Number(e.target.value) })} />
                      <b>{Math.round((round.noticeScale ?? 1.15) * 100)}%</b>
                    </label>
                    <label className="bg-check">
                      <input type="checkbox" checked={round.noticeAsk !== false} onChange={(e) => upd({ noticeAsk: e.target.checked })} />
                      상담 전 질문 넣기 <span className="fhint">(빼면 글자가 커져요)</span>
                    </label>
                  </div>
                )}
              </div>

              <div ref={posterRef} className="poster-hold">
                <Block b={noticeBlock(round, r, center || '○○어린이집')} />
              </div>
              <button className="ghost" onClick={() => saveImage(posterRef, `${r + 1}회차_상담안내문`)} disabled={busy} style={{ marginTop: 12 }}>
                🖼️ 이 안내문 그림(JPG)으로 저장
              </button>
              <p className="hint">그림으로 저장하면 밴드·카카오톡에 그대로 올리거나 한글 문서에 붙여 넣을 수 있어요.</p>
              {saveMsg && <p className="hint">{saveMsg}</p>}
            </div>
          )}
        </>
      )}

      {/* 3. 신청서 (서식 그림 위에) */}
      {cur.id === 'apply' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">이 내용으로 <b>부모님이 작성할 상담 신청서</b>를 만들겠습니다.</p>
            <p className="hint">※ 이름·희망 일시·상담 방법을 적는 <b>칸은 자동으로 붙습니다.</b> 여기서는 안내 문구와 고를 항목만 정하시면 돼요.</p>
            <button className="primary" onClick={makeApply} disabled={busy}>
              {busy ? 'AI가 작성 중입니다…' : `✍️ ${round.applyIntro ? '다시 ' : ''}신청서 만들기`}
            </button>
            {err && <p className="error">⚠️ {err}</p>}

            {round.applyIntro && (
              <>
                <div className="field" style={{ marginTop: 16 }}>
                  <label>맨 위 안내 문구</label>
                  <textarea rows={3} value={round.applyIntro} onChange={(e) => upd({ applyIntro: e.target.value })} />
                </div>
                <div className="field">
                  <label>부모님이 고를 상담 주제 <span className="fhint">(한 줄에 하나씩 · □ 표시는 자동)</span></label>
                  <textarea rows={5} value={round.applyTopics} onChange={(e) => upd({ applyTopics: e.target.value })} />
                </div>
                <div className="field">
                  <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                  <input type="text" value={round.applyFeedback} onChange={(e) => upd({ applyFeedback: e.target.value })}
                    placeholder="예) 형제자매 관련 이야기 항목을 넣어주세요" />
                </div>
                {round.applyFeedback?.trim() && (
                  <button className="ghost" onClick={makeApply} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                )}
              </>
            )}

            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="primary" onClick={next} disabled={!round.applyIntro}>확인 · 상담 내용 정리 →</button>
            </div>
          </div>

          {round.applyIntro && (
            <div className="card wiz-card">
              <h3 className="card-title">이렇게 나옵니다 — 인쇄해서 부모님께 나눠주세요</h3>

              <div className="bg-tools">
                <div className="bg-row">
                  <span className="bg-label">서식 그림</span>
                  <label className="file-btn sm">
                    🖼️ 내 그림 올리기
                    <input type="file" accept="image/*" hidden onChange={(e) => { pickBg(e.target.files[0], 'applyBg'); e.target.value = ''; }} />
                  </label>
                  <button className="bg-btn" onClick={() => upd({ applyBg: applyBgFor(r), applyBottom: applyBottomFor(r) })}>기본 서식</button>
                </div>
                <div className="bg-row sliders">
                  <label>글 시작 위치
                    <input type="range" min="18" max="50" value={round.applyTop ?? 27} onChange={(e) => upd({ applyTop: Number(e.target.value) })} />
                    <b>{round.applyTop ?? 27}%</b>
                  </label>
                  <label>아래 여백
                    <input type="range" min="8" max="35" value={round.applyBottom ?? 15} onChange={(e) => upd({ applyBottom: Number(e.target.value) })} />
                    <b>{round.applyBottom ?? 15}%</b>
                  </label>
                  <label>글자 크기
                    <input type="range" min="0.7" max="2" step="0.05" value={round.applyScale ?? 1.15} onChange={(e) => upd({ applyScale: Number(e.target.value) })} />
                    <b>{Math.round((round.applyScale ?? 1.15) * 100)}%</b>
                  </label>
                </div>
              </div>

              <div ref={applyRef} className="poster-hold">
                <Block b={applyBlock(round, r, center || '○○어린이집')} />
              </div>
              <button className="ghost" onClick={() => saveImage(applyRef, `${r + 1}회차_상담신청서`)} disabled={busy} style={{ marginTop: 12 }}>
                🖼️ 이 신청서 그림(JPG)으로 저장
              </button>
              <p className="hint">인쇄해서 나눠주시거나, 밴드·카카오톡에 그림으로 올리셔도 됩니다.</p>
              {saveMsg && <p className="hint">{saveMsg}</p>}
            </div>
          )}
        </>
      )}

      {/* 4. 상담 실시 내용 */}
      {cur.id === 'result' && (
        <div className="card wiz-card">
          <p className="wiz-lead">이제 <b>실제로 하신 상담 내용</b>을 정리하겠습니다.</p>
          <div className="field">
            <label>{r + 1}회차 상담을 받은 원아는 몇 명인가요? <span className="req">*</span></label>
            <input type="text" value={round.count} onChange={(e) => upd({ count: e.target.value })} placeholder="예) 40명 중 38명" />
          </div>
          <div className="field">
            <label>상담하면서 기억에 남는 내용을 편하게 적어주세요</label>
            <textarea rows={5} value={round.memo} onChange={(e) => upd({ memo: e.target.value })}
              placeholder="예) 적응 걱정하는 부모가 많았고, 편식과 낮잠 이야기가 자주 나왔음. 형제 있는 집은 다툼 이야기." />
            <p className="hint">떠오르는 대로 몇 줄만 적으셔도 됩니다. 비워두면 상담에서 흔히 나오는 주제로 예시를 만들어 드려요.</p>
          </div>

          <button className="primary" onClick={() => askAi('summary', 'summary', 'summaryFeedback')} disabled={busy || !round.count}>
            {busy ? 'AI가 정리 중입니다…' : '✍️ 상담 내용 정리하기'}
          </button>
          {err && <p className="error">⚠️ {err}</p>}

          {round.summary && (
            <>
              <div className="wiz-result">
                <div className="wiz-result-top">AI가 정리한 내용 <span>✏️ 직접 고쳐도 됩니다</span></div>
                <textarea rows={12} value={round.summary} onChange={(e) => upd({ summary: e.target.value })} />
              </div>
              <div className="field">
                <label>고칠 부분을 알려주시면 다시 정리해 드려요 (선택)</label>
                <input type="text" value={round.summaryFeedback} onChange={(e) => upd({ summaryFeedback: e.target.value })}
                  placeholder="예) 편식 이야기를 빼고, 등원 거부 이야기를 넣어주세요" />
              </div>
              {round.summaryFeedback?.trim() && (
                <button className="ghost" onClick={() => askAi('summary', 'summary', 'summaryFeedback')} disabled={busy}>
                  🔁 고친 내용으로 다시 만들기
                </button>
              )}
            </>
          )}

          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next} disabled={!round.summary}>확인 · 사진 넣기 →</button>
          </div>
        </div>
      )}

      {/* 5. 사진 */}
      {cur.id === 'photos' && (
        <div className="card wiz-card">
          <p className="wiz-lead">{r + 1}회차 <b>상담 사진</b>을 넣어주세요. <b>최대 {MAX_PHOTOS}장</b>까지 넣을 수 있고, <b>2장만 있어도 문서는 만들어집니다.</b></p>
          <div className="img-grid">
            {(round.photos || []).map((src, i) => (
              <div className="img-thumb sm" key={i}>
                <img src={src} alt="" />
                <button type="button" className="img-del" onClick={() => upd({ photos: round.photos.filter((_, x) => x !== i) })}>✕</button>
              </div>
            ))}
            {(round.photos?.length || 0) < MAX_PHOTOS && (
              <label className={`img-upload sm ${busy ? 'busy' : ''}`}>
                {busy ? '불러오는 중…' : '＋ 사진 추가'}
                <input type="file" accept="image/*" multiple hidden disabled={busy}
                  onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
          <p className="hint">사진이 없으면 그냥 넘어가셔도 됩니다. 나중에 이 화면으로 돌아와 넣을 수 있어요.</p>
          {err && <p className="error">⚠️ {err}</p>}
          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next}>{r === 0 ? '1회차 정리 보기 →' : '2회차 정리 보기 →'}</button>
          </div>
        </div>
      )}

      {/* 6. 회차 정리 */}
      {cur.id === 'roundend' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              {r === 0
                ? <>1회차 부모개별상담 운영 결과 정리가 만들어졌습니다. <b>이제 2회차 내용으로 넘어갑니다.</b></>
                : <>2회차까지 모두 만들어졌습니다. <b>이제 1·2회차를 한 문서로 저장</b>할 수 있어요.</>}
            </p>
            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="primary" onClick={next}>{r === 0 ? '2회차 시작하기 →' : '문서 저장하기 →'}</button>
            </div>
          </div>
          <div className="page-outer">
            <div className="print-area">
              <PrintSheet>
                {roundBlocksOnly.map((b, i) => <Block key={i} b={b} />)}
              </PrintSheet>
            </div>
          </div>
        </>
      )}

      {/* 7. 저장 */}
      {cur.id === 'save' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">1·2회차를 한 문서로 묶었습니다. <b>PDF</b>나 <b>한글(hwpx)</b>로 저장하세요.</p>
            {!roundHasContent(data.rounds[1]) && (
              <p className="hint" style={{ color: '#b8860b' }}>※ 2회차 내용이 비어 있습니다. 심사에는 연 2회가 필요하니 나중에 꼭 채워주세요.</p>
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
              <button className="ghost" onClick={prev}>← 이전</button>
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

// AI가 글을 쓰고 → 보여주고 → 고칠 곳을 받아 다시 쓰는 단계 (공지문·신청서 공통)
function AiStep({ lead, value, onChange, feedback, onFeedback, onMake, busy, err, makeLabel, nextLabel, onPrev, onNext, extra }) {
  return (
    <div className="card wiz-card">
      <p className="wiz-lead">{lead}</p>
      {extra}
      <button className="primary" onClick={onMake} disabled={busy}>
        {busy ? 'AI가 작성 중입니다…' : `✍️ ${value ? '다시 ' : ''}${makeLabel}`}
      </button>
      {err && <p className="error">⚠️ {err}</p>}

      {value && (
        <>
          <div className="wiz-result">
            <div className="wiz-result-top">만들어진 글 <span>✏️ 직접 고쳐도 됩니다</span></div>
            <textarea rows={12} value={value} onChange={(e) => onChange(e.target.value)} />
          </div>
          <div className="field">
            <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
            <input type="text" value={feedback} onChange={(e) => onFeedback(e.target.value)}
              placeholder="예) 좀 더 짧게, 상담 시간이 20분이라는 것을 넣어주세요" />
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
