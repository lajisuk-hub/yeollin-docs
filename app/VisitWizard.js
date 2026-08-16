'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';
import {
  CHECKPOINTS, KEYWORDS, emptyData, emptyLog, logList,
  buildVisitDoc, buildPosterDoc, toHwpxBlocks,
} from '../lib/visitDoc';
import Block from './NewBlocks';
import PrintSheet from './PrintSheet';

const KEY = 'visit-wizard';

const STEPS = ['basic', 'poster', 'policy', 'log', 'save'];
const STEP_TITLE = {
  basic: '참관 운영 방식 정하기',
  poster: '게시용 참관 안내문 만들기',
  policy: '상시 운영 계획 쓰기',
  log: '참관 기록 넣기',
  save: '문서 저장하기',
};

export default function VisitWizard({ onBack }) {
  const [data, setData] = useState(emptyData());
  const [basic, setBasic] = useState(null);
  const [step, setStep] = useState('basic');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [which, setWhich] = useState('all');
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

  const center = basic?.centerName?.trim() || '';
  const upd = (patch) => setData((d) => ({ ...d, ...patch }));
  const go = (s) => { setErr(''); setStep(s); window.scrollTo(0, 0); };
  const idx = STEPS.indexOf(step);
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const prev = () => go(STEPS[Math.max(idx - 1, 0)]);

  async function ask(kind, extra = {}) {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, center, year: data.year,
          who: data.who, when: data.when, hours: data.hours, place: data.place, how: data.how,
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

  async function makePoster() {
    const j = await ask('poster', data.notice && data.noticeFeedback
      ? { previous: `${data.notice}\n\n${(data.cautions || []).join('\n')}`, feedback: data.noticeFeedback } : {});
    if (j?.result) {
      upd({
        notice: j.result.lead || '',
        cautions: Array.isArray(j.result.cautions) ? j.result.cautions : [],
        noticeFeedback: '',
      });
    }
  }

  async function makePolicy() {
    const j = await ask('policy', data.policy && data.policyFeedback
      ? { previous: data.policy, feedback: data.policyFeedback } : {});
    if (j?.text) upd({ policy: j.text, policyFeedback: '' });
  }

  const docs = {
    all: buildVisitDoc(data, basic || {}),
    poster: buildPosterDoc(data, basic || {}),
  };

  async function saveHwpx(kind) {
    setBusy(true); setErr(''); setSaveMsg('한글 파일을 만드는 중입니다…');
    try {
      const { buildDocHwpx, downloadBlob } = await import('../lib/hwpx');
      const name = kind === 'poster'
        ? `${center || '어린이집'}_참관안내문(게시용).hwpx`
        : `${center || '어린이집'}_부모어린이집참관.hwpx`;
      const blob = await buildDocHwpx({ blocks: toHwpxBlocks(docs[kind]), onProgress: setSaveMsg });
      downloadBlob(blob, name);
      setSaveMsg('한글 파일을 내려받았습니다. (다운로드 폴더를 확인하세요)');
    } catch (e) {
      setErr(e.message || '한글 파일을 만들지 못했습니다');
      setSaveMsg('');
    } finally { setBusy(false); }
  }

  function restart() {
    if (!window.confirm('참관 서류에 작성한 내용을 모두 지우고 처음부터 다시 할까요?')) return;
    clearForm(KEY);
    setData(emptyData()); go('basic');
  }

  const setLog = (i, patch) => upd({ logs: (data.logs || []).map((l, n) => (n === i ? { ...l, ...patch } : l)) });

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 새로 만들 서류 목록으로</button>

      <div className="wiz-head">
        <div className="wiz-bar"><span style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="wiz-count">{idx + 1} / {STEPS.length} 단계 · 부모 어린이집 참관 (5점)</div>
        <h1>{STEP_TITLE[step]}</h1>
      </div>

      {/* ① 기본 */}
      {step === 'basic' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>{center || '우리 어린이집'}</b>의 부모 참관 서류를 만듭니다.<br />
              이 항목은 <b>서류를 내는 것이 아니라 현장에서 확인</b>합니다. 심사위원이 <b>게시된 안내문을 눈으로 보고</b>,
              원장님께 <b>상시로 운영하시는지 면담</b>으로 묻습니다.
            </p>
            <h3 className="wiz-sub">심사에서 확인하는 세 가지</h3>
            <ul className="check4">
              {CHECKPOINTS.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            <h3 className="wiz-sub">꼭 기억할 점</h3>
            <div className="kw-list">
              {KEYWORDS.map((k) => (
                <div className="kw" key={k.t}>
                  <b>#{k.t}</b>
                  <span>{k.d}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card wiz-card">
            <h2 className="wiz-sub">안내문에 들어갈 내용</h2>
            <p className="hint">아래 내용이 <b>참관 자격 · 시기 · 방법</b>으로 안내문에 그대로 들어갑니다. 기본값 그대로 쓰셔도 됩니다.</p>
            <div className="field">
              <label>참관 자격 — 누가 참관할 수 있나요?</label>
              <input type="text" value={data.who} onChange={(e) => upd({ who: e.target.value })} />
            </div>
            <div className="field">
              <label>참관 시기 <span className="edit-badge">⚠️ 기간을 제한하면 안 됩니다</span></label>
              <input type="text" value={data.when} onChange={(e) => upd({ when: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>참관 가능 시간</label>
                <input type="text" value={data.hours} placeholder="예) 오전 9:30 ~ 오후 4:30"
                  onChange={(e) => upd({ hours: e.target.value })} />
              </div>
              <div className="field">
                <label>참관 장소</label>
                <input type="text" value={data.place} onChange={(e) => upd({ place: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>참관 방법 — 어떻게 신청하나요?</label>
              <input type="text" value={data.how} onChange={(e) => upd({ how: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>연락처 (선택)</label>
                <input type="text" value={data.contact} placeholder="예) 031-000-0000"
                  onChange={(e) => upd({ contact: e.target.value })} />
              </div>
              <div className="field">
                <label>연도</label>
                <input type="text" value={data.year} style={{ maxWidth: 140 }}
                  onChange={(e) => upd({ year: e.target.value })} />
              </div>
            </div>
            <button className="next-doc" onClick={next}>게시용 안내문 만들기 →</button>
          </div>
        </>
      )}

      {/* ② 게시문 */}
      {step === 'poster' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              현관·각 반 게시판에 <b>붙여 두는 안내문</b>입니다. 이것이 <b>심사에서 눈으로 확인하는 바로 그 서류</b>입니다.<br />
              인사말과 유의사항만 AI가 쓰고, 자격·시기·방법은 앞에서 정한 내용이 자동으로 들어갑니다.
            </p>
            <button className="primary" onClick={makePoster} disabled={busy}>
              {busy ? 'AI가 작성 중입니다…' : `✍️ ${data.notice ? '다시 ' : ''}안내문 문구 만들기`}
            </button>
            {err && <p className="error">⚠️ {err}</p>}
            {data.notice && (
              <>
                <div className="wiz-result">
                  <div className="wiz-result-top">인사말 <span>✏️ 직접 고쳐도 됩니다</span></div>
                  <textarea rows={4} value={data.notice} onChange={(e) => upd({ notice: e.target.value })} />
                </div>
                <div className="wiz-result">
                  <div className="wiz-result-top">유의사항 <span>✏️ 한 줄에 하나씩</span></div>
                  <textarea rows={4} value={(data.cautions || []).join('\n')}
                    onChange={(e) => upd({ cautions: e.target.value.split('\n') })} />
                </div>
                <div className="field">
                  <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                  <input type="text" value={data.noticeFeedback} onChange={(e) => upd({ noticeFeedback: e.target.value })} />
                </div>
                {data.noticeFeedback?.trim() && (
                  <button className="ghost" onClick={makePoster} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
                )}
              </>
            )}
            <p className="hint">
              💡 만드신 뒤 <b>「게시용 안내문만 PDF로 저장」</b>해서 인쇄해 붙이세요. 현관·각 반 게시판에 <b>상시 게시</b>해야 합니다.
            </p>
            <div className="wiz-nav">
              <button className="ghost" onClick={prev}>← 이전</button>
              <button className="primary" onClick={next}>상시 운영 계획 쓰기 →</button>
            </div>
          </div>
          <div className="page-outer">
            <div className="print-area">
              <PrintSheet>{docs.poster.map((b, i) => <Block key={i} b={b} />)}</PrintSheet>
            </div>
          </div>
        </>
      )}

      {/* ③ 운영 계획 */}
      {step === 'policy' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            <b>상시로 운영한다</b>는 것을 문서로 남겨 둡니다. 심사위원이 <b>면담에서 물어볼 때</b> 근거가 되는 문서입니다.<br />
            비워 두셔도 기본 문구가 들어갑니다.
          </p>
          <button className="primary" onClick={makePolicy} disabled={busy}>
            {busy ? 'AI가 작성 중입니다…' : `✍️ ${data.policy ? '다시 ' : ''}운영 계획 쓰기`}
          </button>
          {err && <p className="error">⚠️ {err}</p>}
          {data.policy && (
            <>
              <div className="wiz-result">
                <div className="wiz-result-top">참관 상시 운영의 목적 <span>✏️ 직접 고쳐도 됩니다</span></div>
                <textarea rows={8} value={data.policy} onChange={(e) => upd({ policy: e.target.value })} />
              </div>
              <div className="field">
                <label>고칠 부분을 알려주시면 다시 만들어 드려요 (선택)</label>
                <input type="text" value={data.policyFeedback} onChange={(e) => upd({ policyFeedback: e.target.value })} />
              </div>
              {data.policyFeedback?.trim() && (
                <button className="ghost" onClick={makePolicy} disabled={busy}>🔁 고친 내용으로 다시 만들기</button>
              )}
            </>
          )}
          <p className="hint">
            ※ 운영 원칙·유의사항은 심사 기준에 맞추어 <b>자동으로 들어갑니다</b> (제한 없는 상시 운영, 지켜보는 참관, 적응기간과 구분 등).
          </p>
          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next}>참관 기록 넣기 →</button>
          </div>
        </div>
      )}

      {/* ④ 참관 기록 */}
      {step === 'log' && (
        <div className="card wiz-card">
          <p className="wiz-lead">
            실제로 참관하신 분이 있으면 적어주세요. <b>평정기간 내 연 1회 이상</b> 있으면 좋습니다.<br />
            아직 없으면 비워 두셔도 됩니다. <b>빈 기록지 양식</b>으로 인쇄되어 나옵니다.
          </p>
          {(data.logs || []).map((l, i) => (
            <div className="visit-log" key={i}>
              <div className="visit-log-no">{i + 1}</div>
              <div className="visit-log-fields">
                <div className="field-row">
                  <div className="field">
                    <label>참관일</label>
                    <input type="date" value={l.date} onChange={(e) => setLog(i, { date: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>참관자</label>
                    <input type="text" value={l.parent} placeholder="예) 김○○ 어머니"
                      onChange={(e) => setLog(i, { parent: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>반</label>
                    <input type="text" value={l.cls} placeholder="예) 햇님반"
                      onChange={(e) => setLog(i, { cls: e.target.value })} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>시작 시간</label>
                    <input type="text" value={l.from} placeholder="예) 10:00" onChange={(e) => setLog(i, { from: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>끝 시간</label>
                    <input type="text" value={l.to} placeholder="예) 11:00" onChange={(e) => setLog(i, { to: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>참관 내용 및 의견</label>
                  <textarea rows={2} value={l.content} placeholder="예) 오전 놀이 시간 참관. 아이가 친구들과 잘 어울려 지내는 모습을 보고 안심했다고 함."
                    onChange={(e) => setLog(i, { content: e.target.value })} />
                </div>
              </div>
              {(data.logs || []).length > 1 && (
                <button type="button" className="mem-del" onClick={() => upd({ logs: data.logs.filter((_, n) => n !== i) })}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="ghost sm" onClick={() => upd({ logs: [...(data.logs || []), emptyLog()] })}>＋ 참관 기록 추가</button>
          <p className="hint">지금 {logList(data).length}건을 적으셨습니다.</p>
          <div className="wiz-nav">
            <button className="ghost" onClick={prev}>← 이전</button>
            <button className="primary" onClick={next}>저장하기 →</button>
          </div>
        </div>
      )}

      {/* ⑤ 저장 */}
      {step === 'save' && (
        <>
          <div className="card wiz-card">
            <p className="wiz-lead">
              <b>게시용 안내문</b>은 인쇄해서 붙이시고, <b>전체 문서</b>는 원에 보관하세요.
            </p>
            <div className="range-row">
              {[['poster', '게시용 안내문 (붙이는 것)'], ['all', '전체 문서 (보관용)']].map(([k, label]) => (
                <button key={k} className={`range-chip ${which === k ? 'on' : ''}`} onClick={() => setWhich(k)}>{label}</button>
              ))}
            </div>
            <div className="wiz-saves">
              <button className="primary" onClick={() => window.print()}>🖨️ PDF로 저장</button>
              <button className="ghost" onClick={() => saveHwpx(which)} disabled={busy}>📄 한글(hwpx)로 저장</button>
            </div>
            {saveMsg && <p className="hint">{saveMsg}</p>}
            {err && <p className="error">⚠️ {err}</p>}
            <p className="hint" style={{ color: '#b3620a' }}>
              ⚠️ 이 항목은 <b>서류를 내는 것이 아니라 현장에서 확인</b>합니다.
              게시용 안내문을 꼭 <b>현관과 각 반 게시판에 붙여 두세요.</b>
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
