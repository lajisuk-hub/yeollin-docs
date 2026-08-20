'use client';

import { useState, useEffect, useRef } from 'react';
import { saveForm, loadForm, clearForm } from '../lib/store';

// 서류를 새로 만들기 위한 기본사항 등록.
// 어린이집 → 교직원 → 반 → 원아 순서로 하나씩 펼쳐서 채우는 방식(연계 입력).
export const BASIC_KEY = 'basic-info';

const ROLES = ['원장', '원감', '주임교사', '담임교사', '연장반교사', '보조교사', '특수교사', '간호사', '영양사', '조리원', '사무원', '기타'];
const AGES = ['만 0세', '만 1세', '만 2세', '만 3세', '만 4세', '만 5세', '혼합연령', '장애아 통합'];

const uid = () => Math.random().toString(36).slice(2, 9);
const EMPTY = { centerName: '', staff: [] };

export default function BasicInfo({ onBack, onHome, onGoDocs }) {
  const [info, setInfo] = useState(EMPTY);
  const [open, setOpen] = useState({ center: true });
  const [saved, setSaved] = useState(false);
  const loaded = useRef(false);
  const timer = useRef(null);

  // ── 자동 저장/복원 (같은 브라우저) ──
  useEffect(() => {
    let alive = true;
    loadForm(BASIC_KEY).then((d) => {
      if (!alive) return;
      if (d && typeof d.centerName === 'string') setInfo({ ...EMPTY, ...d });
      loaded.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveForm(BASIC_KEY, info).then((ok) => { if (ok) setSaved(true); });
    }, 600);
    return () => clearTimeout(timer.current);
  }, [info]);

  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const setStaff = (fn) => setInfo((p) => ({ ...p, staff: fn(p.staff) }));
  const mapClasses = (sid, fn) => setStaff((s) => s.map((x) => (x.id === sid ? { ...x, classes: fn(x.classes) } : x)));

  const addStaff = () => {
    const id = uid();
    setStaff((s) => [...s, { id, role: s.length === 0 ? '원장' : '담임교사', name: '', classes: [] }]);
    setOpen((o) => ({ ...o, [id]: true }));
  };
  const updStaff = (id, patch) => setStaff((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const delStaff = (id, name) => {
    if (!window.confirm(`${name || '이 교직원'} 정보를 지울까요? (담당 반·원아도 함께 지워집니다)`)) return;
    setStaff((s) => s.filter((x) => x.id !== id));
  };

  const addClass = (sid) => {
    const id = uid();
    mapClasses(sid, (c) => [...c, { id, className: '', age: '', count: '', children: [] }]);
    setOpen((o) => ({ ...o, [id]: true }));
  };
  const updClass = (sid, cid, patch) => mapClasses(sid, (c) => c.map((x) => (x.id === cid ? { ...x, ...patch } : x)));
  const delClass = (sid, cid, name) => {
    if (!window.confirm(`${name || '이 반'} 정보를 지울까요? (원아 명단도 함께 지워집니다)`)) return;
    mapClasses(sid, (c) => c.filter((x) => x.id !== cid));
  };

  const addChildren = (sid, cid, text) => {
    const names = text.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
    if (!names.length) return;
    mapClasses(sid, (c) => c.map((x) => (x.id === cid ? { ...x, children: [...x.children, ...names] } : x)));
  };
  const delChild = (sid, cid, idx) =>
    mapClasses(sid, (c) => c.map((x) => (x.id === cid ? { ...x, children: x.children.filter((_, i) => i !== idx) } : x)));

  const resetAll = () => {
    if (!window.confirm('등록한 기본사항을 모두 지우고 처음부터 다시 입력할까요?')) return;
    clearForm(BASIC_KEY);
    setInfo(EMPTY);
  };

  const classes = info.staff.flatMap((s) => s.classes);
  const childCount = classes.reduce((n, c) => n + c.children.length, 0);
  const ready = !!info.centerName.trim() && info.staff.some((s) => s.name.trim());

  return (
    <div className="wrap">
      <button className="back" onClick={onBack}>← 서류 만드는 방식 다시 고르기</button>

      <div className="basic-hero">
        <div className="basic-tag">서류 새로 만들기 · 1단계</div>
        <h1>기본사항 등록</h1>
        <p>
          서류를 하나하나 만들려면 <b>우리 원의 기본 정보</b>가 먼저 필요합니다.<br />
          <b>어린이집 → 교직원 → 반 → 원아</b> 순서로, 각 칸을 <b>눌러서 펼치며</b> 채워주세요.
        </p>
      </div>

      <div className="basic-sum">
        <span>교직원 <b>{info.staff.length}</b>명</span>
        <span>반 <b>{classes.length}</b>개</span>
        <span>원아 <b>{childCount}</b>명</span>
        {saved && <span className="basic-saved">✓ 자동 저장됨</span>}
      </div>

      {/* ① 어린이집 */}
      <div className="tree">
        <div className="tnode center">
          <button className="tnode-head" onClick={() => toggle('center')}>
            <span className="tarrow">{open.center ? '▾' : '▸'}</span>
            <span className="tlabel">🏫 어린이집</span>
            <span className="tvalue">{info.centerName || '이름을 입력하세요'}</span>
          </button>

          {open.center && (
            <div className="tbody">
              <label className="field">
                <span className="flabel">어린이집 이름 <b className="req">*</b></span>
                <input
                  type="text" value={info.centerName} placeholder="예) 햇살어린이집"
                  onChange={(e) => setInfo((p) => ({ ...p, centerName: e.target.value }))}
                />
              </label>

              {/* ② 교직원 */}
              <div className="tsub">
                <div className="tsub-head">
                  <h3>👩‍🏫 교직원 (원장·교사 이름)</h3>
                  <button className="tadd" onClick={addStaff}>+ 교직원 추가</button>
                </div>
                {info.staff.length === 0 && (
                  <p className="thint">원장님부터 추가해 보세요. 이름을 누르면 그 선생님의 <b>반</b>을 넣을 수 있어요.</p>
                )}

                {info.staff.map((s) => (
                  <div key={s.id} className="tnode staff">
                    <div className="tnode-head as-row">
                      <button className="tarrow-btn" onClick={() => toggle(s.id)}>
                        <span className="tarrow">{open[s.id] ? '▾' : '▸'}</span>
                      </button>
                      <select value={s.role} onChange={(e) => updStaff(s.id, { role: e.target.value })}>
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <input
                        type="text" className="tname" value={s.name} placeholder="이름 (예: 김보육)"
                        onChange={(e) => updStaff(s.id, { name: e.target.value })}
                      />
                      <span className="tcount">반 {s.classes.length}</span>
                      <button className="tdel" onClick={() => delStaff(s.id, s.name)} title="삭제">✕</button>
                    </div>

                    {open[s.id] && (
                      <div className="tbody">
                        {/* ③ 반 */}
                        <div className="tsub-head">
                          <h4>🚪 {s.name || '이 선생님'}이 맡은 반</h4>
                          <button className="tadd small" onClick={() => addClass(s.id)}>+ 반 추가</button>
                        </div>
                        {s.classes.length === 0 && <p className="thint">반을 추가하면 <b>반 이름·연령·인원</b>과 <b>원아 이름</b>을 넣을 수 있어요. (원장·조리원처럼 담당 반이 없으면 비워두세요)</p>}

                        {s.classes.map((c) => (
                          <div key={c.id} className="tnode klass">
                            <div className="tnode-head as-row">
                              <button className="tarrow-btn" onClick={() => toggle(c.id)}>
                                <span className="tarrow">{open[c.id] ? '▾' : '▸'}</span>
                              </button>
                              <input
                                type="text" className="tname" value={c.className} placeholder="반 이름 (예: 햇님반)"
                                onChange={(e) => updClass(s.id, c.id, { className: e.target.value })}
                              />
                              <select value={c.age} onChange={(e) => updClass(s.id, c.id, { age: e.target.value })}>
                                <option value="">연령 선택</option>
                                {AGES.map((a) => <option key={a}>{a}</option>)}
                              </select>
                              <input
                                type="number" min="0" className="tnum" value={c.count} placeholder="인원"
                                onChange={(e) => updClass(s.id, c.id, { count: e.target.value })}
                              />
                              <span className="tcount">원아 {c.children.length}</span>
                              <button className="tdel" onClick={() => delClass(s.id, c.id, c.className)} title="삭제">✕</button>
                            </div>

                            {open[c.id] && (
                              <div className="tbody">
                                {/* ④ 원아 */}
                                <h4 className="tchild-title">🧒 {c.className || '이 반'} 원아 이름</h4>
                                <ChildInput onAdd={(t) => addChildren(s.id, c.id, t)} />
                                {c.children.length > 0 ? (
                                  <div className="kid-chips">
                                    {c.children.map((n, i) => (
                                      <span key={i} className="kid-chip">
                                        {n}
                                        <button onClick={() => delChild(s.id, c.id, i)} title="삭제">✕</button>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="thint">아직 원아가 없어요. 위 칸에 이름을 쓰고 Enter를 누르세요.</p>
                                )}
                                {c.count && c.children.length > 0 && Number(c.count) !== c.children.length && (
                                  <p className="tmismatch">※ 적어둔 인원({c.count}명)과 입력한 이름 수({c.children.length}명)가 다릅니다.</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="basic-foot">
        <p className={ready ? 'basic-ok' : 'basic-todo'}>
          {ready
            ? '👍 기본사항이 저장되었습니다. 앞으로 서류를 만들 때 어린이집 이름이 자동으로 채워집니다.'
            : '어린이집 이름과 교직원 이름을 넣으면 저장됩니다. (입력하는 대로 자동 저장돼요)'}
        </p>
        <p className="basic-next">
          👉 다음 단계 : 여기 등록한 <b>어린이집·교직원·반·원아 정보로 서류를 만듭니다.</b>
          가진 자료가 없어도 안내문·명단표·기록지까지 한 번에 만들어져요.
        </p>
        <div className="basic-btns">
          <button className="ghost" onClick={resetAll}>기본사항 초기화</button>
          <button className="primary" onClick={onGoDocs}>다음 · 서류 만들기 →</button>
        </div>
        <button className="linklike" onClick={onHome}>첫 화면으로</button>
      </div>
    </div>
  );
}

// 원아 이름 입력칸 (Enter 또는 쉼표로 여러 명 한 번에)
function ChildInput({ onAdd }) {
  const [text, setText] = useState('');
  const submit = () => { onAdd(text); setText(''); };
  return (
    <div className="child-input">
      <input
        type="text" value={text}
        placeholder="이름을 쓰고 Enter (여러 명은 쉼표로: 김하늘, 이바다, 박소망)"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
      />
      <button onClick={submit}>추가</button>
    </div>
  );
}
