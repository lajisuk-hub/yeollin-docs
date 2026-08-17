'use client';

// 부모 어린이집 참관 "기존 서류 정리" (②번 길)
// 원장님이 정한 순서 그대로 4단계:
//   1. 참관 안내문 올리기 (게시하고 계신 것) — 글자가 읽히면 심사 항목 3가지가 들어 있는지 점검
//   2. 참관 신청서 양식 올리기
//   3. 참관을 신청하신 분이 있으면 참관 기록 작성 (없으면 비워도 됨)
//   4. 관련 사진 올리기 → 문서로 정리

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm, setDocState } from '../lib/store';
import { filesToImages } from '../lib/image';
import { extractTextFromFile } from '../lib/extract';
import {
  MUSTS, KEYWORDS, emptyTidyData, emptyLog, listOf, logList, tidyHasContent,
  buildVisitTidyDoc, buildNoticeOnlyDoc, buildApplyOnlyDoc, toHwpxBlocks,
} from '../lib/visitTidyDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'visit-tidy';
const DOC_ID = 'visit-tidy';
const MAX_PHOTOS = 4;

const STEPS = ['notice', 'apply', 'logs', 'save'];
const STEP_TITLE = {
  notice: '1. 참관 안내문 올리기',
  apply: '2. 참관 신청서 양식 올리기',
  logs: '3. 참관 기록 작성하기',
  save: '4. 사진 올리고 문서로 정리하기',
};

const SAVE_KINDS = [
  { k: 'all', label: '전체 문서 (제출용)' },
  { k: 'notice', label: '안내문만 (게시용)' },
  { k: 'apply', label: '신청서 양식만 (비치용)' },
];

export default function VisitTidy({ onBack }) {
  const [data, setData] = useState(emptyTidyData());
  const [basic, setBasic] = useState(null);
  const [step, setStep] = useState('notice');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saveKind, setSaveKind] = useState('all');
  const [done, setDone] = useState(false);
  const loadedRef = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info')]).then(([saved, b]) => {
      if (!alive) return;
      setBasic(b || {});
      if (saved) {
        setData({ ...emptyTidyData(), ...saved });
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

  // ── 서식 올리기 (사진·PDF → 이미지). 안내문은 글자도 함께 뽑아 둔다 ──
  async function pickForm(kind, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy(kind);
    try {
      const urls = await filesToImages(files);
      const names = files.map((f) => f.name);
      const patch = kind === 'notice'
        ? { noticeImgs: [...listOf(data.noticeImgs), ...urls], noticeFiles: [...listOf(data.noticeFiles), ...names] }
        : { applyImgs: [...listOf(data.applyImgs), ...urls], applyFiles: [...listOf(data.applyFiles), ...names] };

      // 안내문은 글자를 읽을 수 있으면 함께 담아 둔다 (심사 항목 점검용)
      if (kind === 'notice') {
        let text = data.noticeText || '';
        for (const f of files) {
          if (!/\.(pdf|hwpx|docx|txt)$/i.test(f.name || '')) continue;
          try {
            const t = await extractTextFromFile(f);
            if (t.trim()) text += `${text ? '\n\n' : ''}${t}`;
          } catch { /* 사진으로 된 안내문이면 글자를 못 읽는다 — 그대로 둔다 */ }
        }
        patch.noticeText = text;
      }
      setData((d) => ({ ...d, ...patch }));
    } catch {
      setErr('파일을 불러오지 못했습니다. 사진(jpg·png) 또는 PDF로 다시 시도해 주세요.');
    } finally { setBusy(''); }
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy('photo');
    try {
      const room = MAX_PHOTOS - (data.photos?.length || 0);
      const urls = await filesToImages(files.slice(0, room));
      upd({ photos: [...(data.photos || []), ...urls] });
    } catch {
      setErr('사진을 불러오지 못했습니다.');
    } finally { setBusy(''); }
  }

  // ── 안내문 점검 (AI) ──
  async function checkNotice() {
    setBusy('check'); setErr('');
    try {
      const res = await fetch('/api/visit-tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'check', center, noticeSrc: data.noticeText }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      upd({ check: j.result, checked: true });
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
    } finally { setBusy(''); }
  }

  // ── 참관 기록 ──
  const setLog = (i, patch) => upd({ logs: (data.logs || []).map((l, n) => (n === i ? { ...l, ...patch } : l)) });
  const addLog = () => upd({ logs: [...(data.logs || []), emptyLog()] });
  const delLog = () => upd({ logs: (data.logs || []).slice(0, -1) });

  // ── 문서 ──
  const blocks = saveKind === 'notice'
    ? buildNoticeOnlyDoc(data, basic || {})
    : saveKind === 'apply'
      ? buildApplyOnlyDoc(data, basic || {})
      : buildVisitTidyDoc(data, basic || {});

  async function saveHwpx() {
    setBusy('hwpx'); setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_${year}_어린이집참관.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. ⚠️ 올리신 안내문·신청서 그림은 한글 파일에 들어가지 않습니다. (PDF로 저장하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(''); }
  }

  // 올린 서식 미리보기 (썸네일 + 삭제)
  const Thumbs = ({ items, onDel }) => (
    <div className="img-grid">
      {(items || []).map((src, i) => (
        <div className="img-thumb" key={i}>
          <img src={src} alt="" />
          <button type="button" className="img-del" onClick={() => onDel(i)}>✕</button>
        </div>
      ))}
    </div>
  );

  const ck = data.check;

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 문서 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-bar"><span style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="wiz-count">{idx + 1} / {STEPS.length} 단계 · 어린이집 참관 서류 정리</div>
        <h1>{STEP_TITLE[step]}</h1>
      </div>

      {err && <p className="error">⚠️ {err}</p>}

      {/* ───────── 1. 참관 안내문 ───────── */}
      {step === 'notice' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            어린이집에 <b>게시하고 계신 참관 안내문</b>을 올려 주세요. 사진으로 찍으셔도 되고 PDF·한글 파일도 됩니다.
          </p>
          <div className="tidy-note">
            🔎 <b>참관은 서류를 내는 항목이 아니라 현장에서 확인하는 항목</b>입니다.
            심사에서는 ①상시 참관이 가능한지 ②부모님이 볼 수 있는 곳에 안내문이 붙어 있는지
            ③안내문에 <b>참관 자격 · 시기 · 방법</b>이 들어 있는지를 봅니다.
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

          <div className="tidy-sec">
            <h4>참관 안내문 올리기</h4>
            <label className="file-btn">
              {busy === 'notice' ? '불러오는 중…' : (listOf(data.noticeImgs).length ? '📎 안내문 더 올리기' : '📎 참관 안내문 올리기 (사진 · PDF)')}
              <input type="file" accept="image/*,application/pdf,.hwpx,.docx,.txt" multiple hidden disabled={!!busy}
                onChange={(e) => { pickForm('notice', e.target.files); e.target.value = ''; }} />
            </label>
            {listOf(data.noticeFiles).length > 0 && <span className="tidy-file">✔ {listOf(data.noticeFiles).join(' · ')}</span>}
            <Thumbs items={data.noticeImgs} onDel={(i) => upd({ noticeImgs: data.noticeImgs.filter((_, n) => n !== i) })} />
          </div>

          {/* 안내문 점검 */}
          <div className="tidy-sec">
            <h4>안내문에 꼭 들어가야 하는 세 가지 점검</h4>
            {data.noticeText?.trim() ? (
              <>
                <p className="hint">올리신 안내문의 글자를 읽어 <b>참관 자격 · 시기 · 방법</b>이 들어 있는지 확인해 드립니다.</p>
                <button className="primary" onClick={checkNotice} disabled={!!busy}>
                  {busy === 'check' ? 'AI가 안내문을 살펴보는 중입니다…' : `🔎 ${data.checked ? '다시 ' : ''}안내문 점검하기`}
                </button>
              </>
            ) : (
              <p className="hint">
                {listOf(data.noticeImgs).length
                  ? '📷 사진으로 올리셔서 글자를 읽을 수 없습니다. 아래 세 가지가 안내문에 들어 있는지 눈으로 확인해 주세요.'
                  : '안내문을 올리시면 점검해 드립니다. (글자가 들어 있는 PDF·한글 파일이면 AI가 자동으로 확인합니다)'}
              </p>
            )}

            <div className="chk-list" style={{ marginTop: 10 }}>
              {MUSTS.map((m) => {
                const r = ck?.[m.k];
                const on = !!r?.ok;
                return (
                  <span key={m.k} className={`chk ${on ? 'on' : ''}`} title={m.hint}>
                    <span>{on ? '✅' : (data.checked ? '⚠️' : '·')} {m.label}</span>
                  </span>
                );
              })}
            </div>

            {data.checked && ck && (
              <div className={MUSTS.every((m) => ck[m.k]?.ok) ? 'tidy-sum' : 'tidy-missing'}>
                <h4>{MUSTS.every((m) => ck[m.k]?.ok) ? '✅ 세 가지가 모두 들어 있습니다' : '⚠️ 보완하면 좋을 부분'}</h4>
                <ul>
                  {MUSTS.map((m) => (
                    <li key={m.k}>
                      <b>{m.label}</b> — {ck[m.k]?.ok ? `있음 (${ck[m.k].found})` : '안내문에서 찾지 못했습니다.'}
                    </li>
                  ))}
                  {(ck.limits || []).map((t, i) => <li key={`l${i}`} style={{ color: '#b3620a' }}>제한 표현: {t}</li>)}
                </ul>
                {ck.advice && <p className="hint" style={{ marginTop: 8 }}>{ck.advice}</p>}
              </div>
            )}

            <details className="tidy-peek" style={{ marginTop: 10 }}>
              <summary>참관에서 꼭 기억할 것 (심사 핵심)</summary>
              <ul className="kw-list">
                {KEYWORDS.map((k) => <li key={k.t}><b>{k.t}</b> — {k.d}</li>)}
              </ul>
            </details>

            {data.noticeText?.trim() && (
              <details className="tidy-peek">
                <summary>읽어낸 안내문 글자 보기 · 고치기 ({data.noticeText.length.toLocaleString()}자)</summary>
                <textarea rows={8} value={data.noticeText} onChange={(e) => upd({ noticeText: e.target.value })} />
              </details>
            )}
          </div>

          <div className="wiz-nav">
            <button className="ghost" onClick={onBack}>← 문서 목록</button>
            <button className="primary" onClick={next}>다음 · 신청서 양식 올리기 →</button>
          </div>
        </div>
      )}

      {/* ───────── 2. 신청서 양식 ───────── */}
      {step === 'apply' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            부모님이 작성하시는 <b>참관 신청서 양식</b>을 올려 주세요. (사무실에 비치해 두신 그 양식입니다)
          </p>
          <p className="hint">사진 · PDF · 한글 파일 모두 됩니다. 여러 장이면 이어서 올리세요.</p>

          <div className="tidy-sec">
            <h4>참관 신청서 양식 올리기</h4>
            <label className="file-btn">
              {busy === 'apply' ? '불러오는 중…' : (listOf(data.applyImgs).length ? '📎 양식 더 올리기' : '📎 참관 신청서 양식 올리기 (사진 · PDF)')}
              <input type="file" accept="image/*,application/pdf" multiple hidden disabled={!!busy}
                onChange={(e) => { pickForm('apply', e.target.files); e.target.value = ''; }} />
            </label>
            {listOf(data.applyFiles).length > 0 && <span className="tidy-file">✔ {listOf(data.applyFiles).join(' · ')}</span>}
            <Thumbs items={data.applyImgs} onDel={(i) => upd({ applyImgs: data.applyImgs.filter((_, n) => n !== i) })} />
          </div>

          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next}>다음 · 참관 기록 쓰기 →</button>
          </div>
        </div>
      )}

      {/* ───────── 3. 참관 기록 ───────── */}
      {step === 'logs' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            <b>참관을 신청하고 다녀가신 보호자가 있으면</b> 아래에 적어 주세요.
          </p>
          <p className="hint">
            신청하신 분이 없으면 <b>비워 두고 넘어가셔도 됩니다.</b> 문서에는
            &lsquo;신청하신 보호자가 없어 기록이 비어 있으며 연중 상시로 운영하고 있다&rsquo;는 문장이 들어갑니다.
          </p>

          <div className="tidy-sec">
            <h4>참관 기록</h4>
            {(data.logs || []).map((l, i) => (
              <div className="visit-log" key={i}>
                <div className="visit-log-no">{i + 1}</div>
                <div className="visit-log-body">
                  <div className="wiz-3col">
                    <div className="field">
                      <label>참관일</label>
                      <input type="date" value={l.date} onChange={(e) => setLog(i, { date: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>참관자</label>
                      <input type="text" value={l.parent} placeholder="예) 김○○ (모)" onChange={(e) => setLog(i, { parent: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>반</label>
                      <input type="text" value={l.cls} placeholder="예) 햇님반" onChange={(e) => setLog(i, { cls: e.target.value })} />
                    </div>
                  </div>
                  <div className="wiz-2col">
                    <div className="field">
                      <label>시작 시각</label>
                      <input type="text" value={l.from} placeholder="예) 10:00" onChange={(e) => setLog(i, { from: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>끝난 시각</label>
                      <input type="text" value={l.to} placeholder="예) 10:40" onChange={(e) => setLog(i, { to: e.target.value })} />
                    </div>
                  </div>
                  <div className="field">
                    <label>참관 내용 및 의견</label>
                    <textarea rows={3} value={l.content}
                      placeholder="예) 오전 자유놀이와 간식 시간을 참관함. 아이가 친구들과 어울려 노는 모습을 보고 안심이 된다는 의견을 주심."
                      onChange={(e) => setLog(i, { content: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
            <div className="mem-tools">
              <button type="button" className="ghost sm" onClick={addLog}>＋ 참관 기록 추가</button>
              {(data.logs || []).length > 1 && <button type="button" className="ghost sm" onClick={delLog}>마지막 칸 지우기</button>}
            </div>
            <p className="hint">지금 <b>{logList(data).length}건</b>이 문서에 들어갑니다.</p>
          </div>

          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next}>다음 · 사진 올리고 정리하기 →</button>
          </div>
        </div>
      )}

      {/* ───────── 4. 사진 + 전체 문서 ───────── */}
      {step === 'save' && (
        <>
          <div className="card wiz-card">
            <div className="tidy-sec">
              <h4>참관 사진 <span className="tidy-once">있으면 넣어 주세요</span></h4>
              <p className="hint">참관 안내문이 게시된 모습, 참관하시는 모습 등을 최대 {MAX_PHOTOS}장까지 넣을 수 있습니다.</p>
              <div className="img-grid">
                {(data.photos || []).map((src, i) => (
                  <div className="img-thumb sm" key={i}>
                    <img src={src} alt="" />
                    <button type="button" className="img-del" onClick={() => upd({ photos: data.photos.filter((_, n) => n !== i) })}>✕</button>
                  </div>
                ))}
                {(data.photos?.length || 0) < MAX_PHOTOS && (
                  <label className={`img-upload sm ${busy === 'photo' ? 'busy' : ''}`}>
                    {busy === 'photo' ? '불러오는 중…' : '＋ 사진 추가'}
                    <input type="file" accept="image/*,application/pdf" multiple hidden disabled={!!busy}
                      onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                  </label>
                )}
              </div>
            </div>

            <div className="tidy-sec">
              <h4>맨 아래 덧붙일 말 (선택)</h4>
              <input type="text" value={data.memo || ''} placeholder="예) 참관 안내문은 현관과 각 반 게시판에 게시하고 있습니다."
                onChange={(e) => upd({ memo: e.target.value })} />
            </div>

            <div className="tidy-sec">
              <h4>무엇을 저장할까요?</h4>
              <div className="range-row">
                {SAVE_KINDS.map((s) => (
                  <button key={s.k} className={`range-chip ${saveKind === s.k ? 'on' : ''}`} onClick={() => setSaveKind(s.k)}>{s.label}</button>
                ))}
              </div>
            </div>

            {!listOf(data.noticeImgs).length && (
              <p className="hint" style={{ color: '#b3620a' }}>
                ⚠️ 참관 안내문을 아직 올리지 않으셨습니다. <button type="button" className="linkish" onClick={() => go('notice')}>올리러 가기</button>
              </p>
            )}
            {!listOf(data.applyImgs).length && (
              <p className="hint" style={{ color: '#b3620a' }}>
                ⚠️ 신청서 양식을 아직 올리지 않으셨습니다. <button type="button" className="linkish" onClick={() => go('apply')}>올리러 가기</button>
              </p>
            )}

            <div className="wiz-nav">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장 (또는 인쇄)</button>
              <button className="ghost" onClick={saveHwpx} disabled={!!busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}

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
