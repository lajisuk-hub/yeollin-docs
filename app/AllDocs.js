'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm } from '../lib/store';
import {
  SECTIONS, emptyAll, sectionHasData, buildAllDoc, scheduleRows, scheduleTable, toHwpxBlocks,
} from '../lib/allDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'all-docs';

export default function AllDocs({ onBack, onOpenDoc }) {
  const [all, setAll] = useState(emptyAll());
  const [basic, setBasic] = useState(null);
  const [docs, setDocs] = useState({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const loadedRef = useRef(false);
  const timer = useRef(null);

  // 만들어 둔 서류를 모두 불러온다
  useEffect(() => {
    let alive = true;
    Promise.all([
      loadForm(KEY),
      loadForm('basic-info'),
      ...SECTIONS.map((s) => loadForm(s.store)),
    ]).then(([saved, b, ...list]) => {
      if (!alive) return;
      setBasic(b || {});
      const got = {};
      SECTIONS.forEach((s, i) => { got[s.key] = list[i]; });
      setDocs(got);
      if (saved?.year) setAll({ ...emptyAll(), ...saved });
      loadedRef.current = true;
      setReady(true);
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
  const upd = (patch) => setAll((d) => ({ ...d, ...patch }));

  const done = SECTIONS.filter((s) => sectionHasData(s.key, docs[s.key]));
  const missing = SECTIONS.filter((s) => !sectionHasData(s.key, docs[s.key]));
  const blocks = ready ? buildAllDoc(all, basic || {}, docs) : [];
  const rows = ready ? scheduleRows(all, docs) : [];

  async function makeGoal() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/overall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'goal', center, year: all.year,
          docs: done.map((s) => `${s.area} - ${s.name}`).join(', '),
          ...(all.goal && all.goalFeedback ? { previous: all.goal, feedback: all.goalFeedback } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      if (j.text) upd({ goal: j.text, goalFeedback: '' });
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
    } finally { setBusy(false); }
  }

  async function saveHwpx() {
    setBusy(true); setErr(''); setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_${all.year}_열린어린이집_관련서류.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(false); }
  }

  if (!ready) return <div className="wrap" />;

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 서류 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-count">전체 서류 묶기</div>
        <h1>{all.year}년 열린어린이집 관련 서류</h1>
      </div>

      {/* 준비 상태 */}
      <div className="card wiz-card">
        <p className="wiz-lead">
          지금까지 만드신 서류를 <b>한 권으로</b> 묶습니다.<br />
          <b>표지 → 운영 목표 → 연간일정 → 참여성 서류 → 다양성 서류</b> 순서입니다.
        </p>
        <div className="all-list">
          {SECTIONS.map((s) => {
            const ok = sectionHasData(s.key, docs[s.key]);
            return (
              <div className={`all-item ${ok ? 'ok' : ''}`} key={s.key}>
                <span className="all-chk">{ok ? '✓' : '·'}</span>
                <span className="all-area">{s.area}</span>
                <b>{s.name}</b>
                <span className="all-pt">{s.pt}점</span>
                <button className="ghost sm" onClick={() => onOpenDoc(s.key)}>
                  {ok ? '고치러 가기' : '만들러 가기'}
                </button>
              </div>
            );
          })}
        </div>
        {!!missing.length && (
          <p className="hint" style={{ color: '#b8860b' }}>
            ※ 아직 만들지 않은 서류 <b>{missing.length}개</b>는 이 묶음에 들어가지 않습니다.
            ({missing.map((s) => s.name).join(', ')})
          </p>
        )}
        <p className="hint">
          💡 <b>고칠 것이 있으면</b> 위의 <b>「고치러 가기」</b>를 눌러 그 서류로 가서 고친 뒤,
          다시 <b>서류 목록 맨 아래의 「전체 서류 묶기」</b>로 오시면 고친 내용이 그대로 반영됩니다.
        </p>
      </div>

      {/* 운영 목표 */}
      <div className="card wiz-card">
        <h2 className="wiz-sub">1. 열린어린이집 운영 목표</h2>
        <p className="hint">표지 다음 장에 들어갑니다. 비워 두면 기본 문구가 들어갑니다.</p>
        <div className="field-row">
          <div className="field">
            <label>연도</label>
            <input type="text" value={all.year} style={{ maxWidth: 140 }}
              onChange={(e) => upd({ year: e.target.value })} />
          </div>
        </div>
        <button className="primary" onClick={makeGoal} disabled={busy}>
          {busy ? 'AI가 작성 중입니다…' : `✍️ ${all.goal ? '다시 ' : ''}운영 목표 쓰기`}
        </button>
        {err && <p className="error">⚠️ {err}</p>}
        {all.goal && (
          <>
            <div className="wiz-result">
              <div className="wiz-result-top">열린어린이집 운영 목표 <span>✏️ 직접 고쳐도 됩니다</span></div>
              <textarea rows={9} value={all.goal} onChange={(e) => upd({ goal: e.target.value })} />
            </div>
            <div className="field">
              <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
              <input type="text" value={all.goalFeedback} onChange={(e) => upd({ goalFeedback: e.target.value })} />
            </div>
            {all.goalFeedback?.trim() && (
              <button className="ghost" onClick={makeGoal} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
            )}
          </>
        )}
      </div>

      {/* 연간일정 */}
      <div className="card wiz-card">
        <h2 className="wiz-sub">2. 열린어린이집 연간일정</h2>
        <p className="hint">
          만드신 서류의 날짜를 모아 <b>개방성 · 참여성 · 다양성</b>으로 나눠 자동으로 정리했습니다.
          지금 <b>{rows.length}줄</b>입니다.
        </p>
        <p className="hint">아래가 <b>문서에 실제로 들어가는 모양</b>입니다. 고치거나 더할 것이 있으면 말씀해 주세요.</p>
        <div className="mini-doc">
          <Block b={scheduleTable(all, docs)} />
        </div>
        <div className="field">
          <label>더 넣을 일정이 있으면 한 줄에 하나씩 적어주세요 (선택)</label>
          <textarea rows={3} value={all.extra} onChange={(e) => upd({ extra: e.target.value })}
            placeholder={'구분 | 내용 | 시기 | 비고  순서로 적어주세요\n예) 개방성 | 부모 공용 공간 새단장 | 2026년 4월 | 1층 현관'} />
        </div>
      </div>

      {/* 저장 */}
      <div className="card wiz-card">
        <h2 className="wiz-sub">3. 확인하고 저장하기</h2>
        <p className="hint">아래 미리보기를 확인하신 뒤 저장하세요. 지금 <b>{done.length}개 서류</b>가 들어 있습니다.</p>
        <div className="wiz-saves">
          <button className="primary" onClick={() => window.print()}>🖨️ 전체 서류 PDF로 저장 (사진 포함)</button>
          <button className="ghost" onClick={saveHwpx} disabled={busy}>📄 한글(hwpx)로 저장</button>
        </div>
        {saveMsg && <p className="hint">{saveMsg}</p>}
        {err && <p className="error">⚠️ {err}</p>}
        <p className="hint">
          PDF는 인쇄 대화상자에서 <b>대상을 PDF로 저장</b>으로 고르시면 됩니다.<br />
          한글 파일에는 <b>글자와 표만</b> 들어갑니다. 사진·그래프·서식 그림은 PDF를 쓰세요.
        </p>
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
