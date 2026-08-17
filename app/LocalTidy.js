'use client';

// 지자체 자체기준 "서류 정리" (4단계)
// 원장님 지시: 지자체 활동은 지역마다 다양하므로 **충족 내용 자료를 올려 달라고 요청**하고,
//             올리면 AI가 읽어 **지자체 문서로 따로 정리**해서 결과를 보여준다.

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm, setDocState } from '../lib/store';
import { readAnyFile } from '../lib/extract';
import { filesToImages } from '../lib/image';
import {
  emptyTidyData, emptyItem, listOf, itemHasContent, tidyHasContent,
  buildLocalTidyDoc, toHwpxBlocks,
} from '../lib/localTidyDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'local-tidy';
const DOC_ID = 'local-tidy';
const MAX_IMGS = 4;

export default function LocalTidy({ onBack, onNextArea }) {
  const [data, setData] = useState(emptyTidyData());
  const [basic, setBasic] = useState(null);
  const [busy, setBusy] = useState('');
  const [busyMsg, setBusyMsg] = useState('');
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [advice, setAdvice] = useState('');
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
        if (saved.done) setDone(true);
        if (saved.advice) setAdvice(saved.advice);
      }
      loadedRef.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveForm(KEY, { ...data, done, advice });
      setDocState(DOC_ID, done ? 'done' : (tidyHasContent(data) ? 'writing' : null));
    }, 600);
    return () => clearTimeout(timer.current);
  }, [data, done, advice]);

  const center = basic?.centerName?.trim() || '';
  const year = data.year || '2026';
  const upd = (patch) => setData((d) => ({ ...d, ...patch }));
  const updItem = (i, patch) => setData((d) => ({
    ...d, items: (d.items || []).map((x, n) => (n === i ? { ...emptyItem(), ...x, ...patch } : x)),
  }));

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
    setAdvice('');
    setDone(false);
    window.scrollTo(0, 0);
  }

  async function pickSrc(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy('file'); setBusyMsg('파일을 읽는 중입니다…');
    try {
      let added = ''; const names = []; const skipped = [];
      for (const f of files) {
        setBusyMsg(`${f.name} 읽는 중입니다…`);
        const r = await readAnyFile(f, (m) => setBusyMsg(m));
        added += `${added ? '\n\n' : ''}${r.text}`;
        names.push(...r.names);
        skipped.push(...(r.skipped || []));
      }
      setData((d) => ({
        ...d,
        src: d.src ? `${d.src}\n\n${added}` : added,
        files: [...listOf(d.files), ...names],
        skipped: [...listOf(d.skipped), ...skipped],
      }));
    } catch (e) {
      setErr(e.message || '파일을 읽지 못했습니다.');
    } finally { setBusy(''); setBusyMsg(''); }
  }

  async function addImgs(i, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr(''); setBusy(`img${i}`);
    try {
      const x = (data.items || [])[i] || emptyItem();
      const room = MAX_IMGS - (x.imgs?.length || 0);
      const urls = await filesToImages(files.slice(0, room));
      updItem(i, { imgs: [...(x.imgs || []), ...urls] });
    } catch {
      setErr('증빙 자료를 불러오지 못했습니다.');
    } finally { setBusy(''); }
  }

  async function ask(kind, extra = {}) {
    setBusy(kind); setErr('');
    try {
      const res = await fetch('/api/local-tidy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, center, year, region: data.region, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'AI 서버 오류');
      return j;
    } catch (e) {
      setErr(e.message || 'AI를 부르지 못했습니다');
      return null;
    } finally { setBusy(''); }
  }

  async function analyze() {
    const j = await ask('analyze', { src: data.src });
    const r = j?.result;
    if (!r) return;
    const items = (Array.isArray(r.items) ? r.items : []).map((x, i) => ({
      ...emptyItem(),
      ...((data.items || [])[i] || {}),   // 이미 올린 증빙 사진은 그대로 둔다
      title: String(x.title || ''), when: String(x.when || ''), where: String(x.where || ''),
      who: String(x.who || ''), content: String(x.content || ''), proof: String(x.proof || ''),
    }));
    setData((d) => ({
      ...d,
      region: d.region || String(r.region || ''),
      items: items.length ? items : d.items,
      missing: Array.isArray(r.missing) ? r.missing : [],
      analyzed: true,
    }));
    setAdvice(String(r.advice || ''));
  }

  const itemsText = () => (data.items || []).filter(itemHasContent)
    .map((x) => `${x.title || ''} (${x.when || '일시 미상'}) — ${x.where || ''}`).join('\n');

  async function makeIntro() {
    const j = await ask('intro', {
      itemsText: itemsText(),
      ...(data.intro && data.introFeedback?.trim() ? { previous: data.intro, feedback: data.introFeedback } : {}),
    });
    if (j?.text) upd({ intro: j.text, introFeedback: '' });
  }

  const blocks = buildLocalTidyDoc(data, basic || {});

  async function saveHwpx() {
    setBusy('hwpx'); setErr('');
    setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(blocks), onProgress: setSaveMsg });
      downloadBlob(blob, `${center || '어린이집'}_${year}_지자체자체기준.hwpx`);
      setSaveMsg('한글 파일을 내려받았습니다. (증빙 사진은 PDF로 저장해 주세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(''); }
  }

  const items = data.items || [];

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 단계 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-count">4단계 · 지자체 자체기준 (15점)</div>
        <h1>지자체 충족 내용 정리하기</h1>
      </div>

      {err && <p className="error">⚠️ {err}</p>}

      <div className="card wiz-card">
        <p className="wiz-lead">
          지자체 자체기준은 <b>관할 시·군·구마다 항목이 다릅니다.</b>
          우리 원이 <b>충족한 내용의 자료를 올려 주시면</b> AI가 읽어서 <b>지자체 문서로 따로 정리</b>해 드립니다.
        </p>
        <div className="tidy-note">
          📌 흔히 들어가는 항목 — <b>열린어린이집 사업설명회 참여</b>, <b>어린이집 재무회계 교육 이수</b>, <b>문서컨설팅 참여</b> 등.<br />
          ⚠️ 우리 지역 항목은 <b>관할 지자체 공고</b>를 꼭 확인하세요. 지역마다 다릅니다.<br />
          ⚠️ <b>아동학대로 행정처분을 받은 이력</b>이 있으면 점수와 관계없이 선정에서 제외됩니다.
        </div>

        <div className="wiz-3col">
          <div className="field">
            <label>어린이집 이름 <span className="req">*</span></label>
            <input type="text" value={center} placeholder="예) 멘토어린이집" onChange={(e) => setCenter(e.target.value)} />
          </div>
          <div className="field">
            <label>관할 지자체</label>
            <input type="text" value={data.region} placeholder="예) ○○시 / ○○구" onChange={(e) => upd({ region: e.target.value })} />
          </div>
          <div className="field">
            <label>연도</label>
            <select value={year} onChange={(e) => upd({ year: e.target.value })}>
              {['2025', '2026'].map((y) => <option key={y} value={y}>{y}년도</option>)}
            </select>
          </div>
        </div>

        <div className="tidy-sec">
          <h4>지자체 충족 자료 올리기</h4>
          <p className="hint">
            <b>수료증 · 참석확인서 · 이수증 · 공문 · 안내문</b> 등 무엇이든 올려 주세요.
            한글(hwpx) · 워드(docx) · PDF · 텍스트 · <b>압축(zip)</b> 파일을 올릴 수 있고, 여러 개를 이어서 올리셔도 됩니다.
          </p>
          <div className="tidy-src">
            <label className="file-btn">
              {busy === 'file' ? (busyMsg || '읽는 중…') : (listOf(data.files).length ? '📎 자료 더 올리기' : '📎 지자체 충족 자료 올리기')}
              <input type="file" accept=".hwpx,.docx,.pdf,.txt,.zip" multiple hidden disabled={!!busy}
                onChange={(e) => { pickSrc(e.target.files); e.target.value = ''; }} />
            </label>
            {listOf(data.files).length > 0 && (
              <>
                <span className="tidy-file">✔ {listOf(data.files).length}개 파일 읽음</span>
                <button type="button" className="ghost sm" style={{ marginLeft: 8 }}
                  onClick={() => upd({ src: '', files: [], skipped: [], analyzed: false })}>비우기</button>
                <details className="tidy-peek">
                  <summary>읽은 파일 목록 보기</summary>
                  <p className="hint" style={{ marginTop: 6 }}>{listOf(data.files).join(' · ')}</p>
                </details>
              </>
            )}
            {listOf(data.skipped).length > 0 && (
              <p className="hint" style={{ color: '#b3620a' }}>
                ⚠️ 글자를 읽지 못한 파일 {listOf(data.skipped).length}개 (스캔 사진·옛 한글 등) — {listOf(data.skipped).slice(0, 6).join(' · ')}
              </p>
            )}
            {data.src && (
              <details className="tidy-peek">
                <summary>올린 내용 보기 · 고치기 ({data.src.length.toLocaleString()}자)</summary>
                <textarea rows={10} value={data.src} onChange={(e) => upd({ src: e.target.value })} />
              </details>
            )}
          </div>

          <button className="primary" onClick={analyze} disabled={!!busy || !data.src?.trim()}>
            {busy === 'analyze' ? 'AI가 자료를 읽는 중입니다…' : `🤖 ${data.analyzed ? '다시 ' : ''}자료 읽어서 충족 항목으로 정리하기`}
          </button>
          {!data.src?.trim() && <p className="hint">자료를 올리면 정리할 수 있습니다. 자료가 사진뿐이면 아래에서 직접 적으셔도 됩니다.</p>}

          {advice && <div className="tidy-sum"><h4>🔎 살펴본 결과</h4><p className="hint">{advice}</p></div>}
          {(data.missing || []).length > 0 && (
            <div className="tidy-missing">
              <h4>⚠️ 자료에서 찾지 못해 비워 둔 것</h4>
              <ul>{data.missing.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      {/* 충족 항목 목록 */}
      <div className="card wiz-card">
        <h3 className="wiz-sub">충족 항목 <span className="edit-badge">✏️ 직접 고치거나 더 넣어도 됩니다</span></h3>
        {!items.length && <p className="hint">아직 항목이 없습니다. 위에서 자료를 올려 정리하시거나 아래 버튼으로 직접 넣으세요.</p>}

        {items.map((x, i) => (
          <div className="local-item" key={i}>
            <div className="local-item-no">{i + 1}</div>
            <div className="local-item-body">
              <div className="field">
                <label>충족 항목</label>
                <input type="text" value={x.title} placeholder="예) 열린어린이집 사업설명회 참여" onChange={(e) => updItem(i, { title: e.target.value })} />
              </div>
              <div className="wiz-3col">
                <div className="field">
                  <label>일시</label>
                  <input type="text" value={x.when} placeholder="예) 2026. 3. 12." onChange={(e) => updItem(i, { when: e.target.value })} />
                </div>
                <div className="field">
                  <label>주관 · 장소</label>
                  <input type="text" value={x.where} placeholder="예) ○○시 육아종합지원센터" onChange={(e) => updItem(i, { where: e.target.value })} />
                </div>
                <div className="field">
                  <label>참석자</label>
                  <input type="text" value={x.who} placeholder="예) 원장 1명" onChange={(e) => updItem(i, { who: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>내용</label>
                <textarea rows={3} value={x.content} onChange={(e) => updItem(i, { content: e.target.value })} />
              </div>
              <div className="field">
                <label>증빙 자료 이름</label>
                <input type="text" value={x.proof} placeholder="예) 수료증 / 참석확인서" onChange={(e) => updItem(i, { proof: e.target.value })} />
              </div>
              <div className="field">
                <label>증빙 자료 사진·스캔 (최대 {MAX_IMGS}장)</label>
                <div className="img-grid">
                  {(x.imgs || []).map((src, n) => (
                    <div className="img-thumb sm" key={n}>
                      <img src={src} alt="" />
                      <button type="button" className="img-del" onClick={() => updItem(i, { imgs: x.imgs.filter((_, k) => k !== n) })}>✕</button>
                    </div>
                  ))}
                  {(x.imgs?.length || 0) < MAX_IMGS && (
                    <label className={`img-upload sm ${busy === `img${i}` ? 'busy' : ''}`}>
                      {busy === `img${i}` ? '불러오는 중…' : '＋ 증빙 추가'}
                      <input type="file" accept="image/*,application/pdf" multiple hidden disabled={!!busy}
                        onChange={(e) => { addImgs(i, e.target.files); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
              </div>
              <button type="button" className="ghost sm" onClick={() => upd({ items: items.filter((_, n) => n !== i) })}>이 항목 지우기</button>
            </div>
          </div>
        ))}

        <button type="button" className="ghost sm" onClick={() => upd({ items: [...items, emptyItem()] })}>＋ 충족 항목 직접 추가</button>
      </div>

      {/* 문서 앞머리 + 저장 */}
      <div className="card wiz-card">
        <div className="tidy-sec">
          <h4>문서 앞머리 안내글</h4>
          <button className="primary" onClick={makeIntro} disabled={!!busy}>
            {busy === 'intro' ? 'AI가 쓰는 중입니다…' : `✍️ ${data.intro ? '다시 ' : ''}안내글 쓰기`}
          </button>
          {data.intro && <textarea rows={6} style={{ marginTop: 10 }} value={data.intro} onChange={(e) => upd({ intro: e.target.value })} />}
          <p className="hint">비워 두시면 기본 문구가 들어갑니다.</p>
        </div>

        <div className="wiz-nav">
          <button className="primary" onClick={() => window.print()}>🖨️ 지자체 문서 PDF로 저장</button>
          <button className="ghost" onClick={saveHwpx} disabled={!!busy}>📄 한글(hwpx)로 저장</button>
        </div>
        {saveMsg && <p className="hint">{saveMsg}</p>}

        <button type="button" className={`done-btn ${done ? 'on' : ''}`} style={{ marginTop: 14 }} onClick={() => setDone((v) => !v)}>
          {done ? '✅ 작성 완료로 표시했습니다 (누르면 취소)' : '✅ 이 서류 작성 완료로 표시하기'}
        </button>

        {onNextArea && (
          <button className="next-doc" onClick={onNextArea}>
            📚 지자체까지 끝났습니다 · 전체 문서 정리하러 가기 →
          </button>
        )}

        <div className="wiz-nav">
          <button className="ghost" onClick={restart}>처음부터 다시 하기</button>
          <button className="ghost" onClick={onBack}>단계 목록으로</button>
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
