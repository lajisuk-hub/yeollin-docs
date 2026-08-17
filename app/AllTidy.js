'use client';

// ②번 길(기존 서류 정리)로 만든 서류를 한 권으로 묶어 PDF로 뽑는 화면
// 원장님 지시: 전체 문서 정리 후 **고치고 싶은 부분은 각 파트로 넘어가서 수정**하면 된다고 안내한다.

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, getDocStates } from '../lib/store';
import { SECTIONS, STORE_KEYS, emptyAll, buildAllTidyDoc, toHwpxBlocks } from '../lib/allTidyDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'all-tidy';

export default function AllTidy({ onBack, onOpenDoc }) {
  const [all, setAll] = useState(emptyAll());
  const [docs, setDocs] = useState({});
  const [basic, setBasic] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [states, setStates] = useState({});
  const loadedRef = useRef(false);
  const timer = useRef(null);

  // 각 서류의 저장 내용을 모두 읽어 온다
  useEffect(() => {
    let alive = true;
    Promise.all([loadForm(KEY), loadForm('basic-info'), ...STORE_KEYS.map((k) => loadForm(k))]).then((r) => {
      if (!alive) return;
      const [saved, b, ...rest] = r;
      setBasic(b || {});
      if (saved) setAll({ ...emptyAll(), ...saved });
      const map = {};
      SECTIONS.forEach((s, i) => { map[s.key] = rest[i]; });
      setDocs(map);
      setStates(getDocStates());
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveForm(KEY, all); }, 600);
    return () => clearTimeout(timer.current);
  }, [all]);

  const center = basic?.centerName?.trim() || '';
  const year = all.year || '2026';
  const upd = (patch) => setAll((d) => ({ ...d, ...patch }));

  const ready = SECTIONS.filter((s) => docs[s.key] && s.has(docs[s.key]));
  const blocks = buildAllTidyDoc(all, docs, basic || {});

  async function makeGoal() {
    setBusy('goal'); setErr('');
    try {
      const res = await fetch('/api/overall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'goal', center, year,
          ...(all.goal && all.goalFeedback?.trim() ? { previous: all.goal, feedback: all.goalFeedback } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      if (j.text) upd({ goal: j.text, goalFeedback: '' });
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
    } finally { setBusy(''); }
  }

  async function saveHwpx() {
    setBusy('hwpx'); setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_${year}_열린어린이집_전체서류.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. (사진·그림은 PDF로 저장해 주세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(''); }
  }

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 단계 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-count">마지막 · 전체 문서 정리</div>
        <h1>열린어린이집 서류 한 권으로 묶기</h1>
      </div>

      {err && <p className="error">⚠️ {err}</p>}

      <div className="card wiz-card">
        <p className="wiz-lead">
          지금까지 정리하신 서류를 <b>표지 → 운영 목표 → 문서 차례 → 참여성 → 다양성 → 지자체</b> 순서로 한 권에 묶었습니다.
        </p>

        <div className="wiz-2col">
          <div className="field">
            <label>어린이집 이름</label>
            <input type="text" value={center} readOnly />
          </div>
          <div className="field">
            <label>연도</label>
            <select value={year} onChange={(e) => upd({ year: e.target.value })}>
              {['2025', '2026'].map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
        </div>

        {/* 서류별 준비 상태 + 고치러 가기 */}
        <div className="tidy-sec">
          <h4>서류별 준비 상태 <span className="tidy-once">{ready.length} / {SECTIONS.length}</span></h4>
          <p className="hint">
            📌 <b>고치고 싶은 부분이 있으면 「고치러 가기」를 눌러 그 서류로 가서 고치세요.</b>
            고친 뒤 다시 이 화면으로 오시면 전체 문서에 <b>바로 반영</b>됩니다.
          </p>
          <div className="all-list">
            {SECTIONS.map((s) => {
              const ok = docs[s.key] && s.has(docs[s.key]);
              const st = states[s.docId];
              return (
                <div className={`all-item ${ok ? 'ok' : ''}`} key={s.key}>
                  <span className="all-chk">{ok ? '✓' : '·'}</span>
                  <span className="all-area">{s.area}</span>
                  <b>{s.name}</b>
                  <span className="all-pt">{st === 'done' ? '작성 완료' : ok ? '작성 중' : '아직'}</span>
                  <button className="ghost sm" onClick={() => onOpenDoc(s.docId)}>고치러 가기 →</button>
                </div>
              );
            })}
          </div>
          {ready.length < SECTIONS.length && (
            <p className="hint" style={{ color: '#b4661a' }}>
              ⚠️ 아직 {SECTIONS.length - ready.length}개 서류가 비어 있습니다. 지금까지 정리한 것만으로도 저장할 수 있습니다.
            </p>
          )}
        </div>

        {/* 운영 목표 */}
        <div className="tidy-sec">
          <h4>우리 원의 열린어린이집 운영 목표</h4>
          <button className="primary" onClick={makeGoal} disabled={!!busy}>
            {busy === 'goal' ? 'AI가 쓰는 중입니다…' : `✍️ ${all.goal ? '다시 ' : ''}운영 목표 쓰기`}
          </button>
          {all.goal && (
            <>
              <div className="wiz-result-top" style={{ marginTop: 10 }}>
                <span>운영 목표</span>
                <span className="edit-badge">✏️ 직접 고쳐도 됩니다</span>
              </div>
              <textarea rows={7} value={all.goal} onChange={(e) => upd({ goal: e.target.value })} />
              <div className="field">
                <label>고칠 부분이 있으면 적어주세요</label>
                <input type="text" value={all.goalFeedback || ''} placeholder="예) 우리 원 특색인 텃밭 활동을 넣어주세요"
                  onChange={(e) => upd({ goalFeedback: e.target.value })} />
                {all.goalFeedback?.trim() && <button className="ghost" onClick={makeGoal} disabled={!!busy}>🔁 다시 쓰기</button>}
              </div>
            </>
          )}
          <p className="hint">비워 두시면 기본 문구가 들어갑니다.</p>
        </div>

        <div className="tidy-note">
          🖨️ <b>PDF로 저장하는 방법</b> — 아래 <b>PDF로 저장</b>을 누르면 인쇄 창이 열립니다.
          프린터 고르는 곳에서 <b>「PDF로 저장」</b>을 고르고 저장하시면 됩니다.
          (여백은 <b>기본값</b>, 배경 그래픽은 <b>켬</b>으로 두세요)
        </div>

        <div className="wiz-nav">
          <button className="primary" onClick={() => window.print()}>🖨️ 전체 문서 PDF로 저장</button>
          <button className="ghost" onClick={saveHwpx} disabled={!!busy}>📄 한글(hwpx)로 저장</button>
        </div>
        {saveMsg && <p className="hint">{saveMsg}</p>}

        <div className="wiz-nav">
          <button className="ghost" onClick={onBack}>← 단계 목록으로</button>
        </div>
      </div>

      <div className="page-outer">
        <div className="print-area">
          <PrintSheet>
            {blocks.map((b, i) => <Block key={i} b={b} />)}
          </PrintSheet>
        </div>
      </div>
    </div>
  );
}
