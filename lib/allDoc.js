// 지금까지 만든 서류를 한 권으로 묶는 문서
// 표지 → 운영 목표 → 열린어린이집 연간일정(영역별) → 참여성 서류 → 다양성 서류
// 각 서류는 그 서류를 만들 때 저장해 둔 내용을 그대로 가져와 쓴다.

import { buildCounselDoc, roundHasContent as counselHas, periodText as counselPeriod } from './counselDoc';
import { buildCommitteeDoc, MEETINGS, whenText as cmWhen, meetingHasContent } from './committeeDoc';
import { buildProgramDoc, monthList, monthOf, planOf, monthHasContent, whenText as pgWhen } from './programDoc';
import { buildSurveyDoc, periodText as svPeriod } from './surveyDoc';
import { buildVisitDoc } from './visitDoc';
import { buildLinkDoc, actOf, planOf as lkPlan, actHasContent, whenText as lkWhen } from './linkDoc';

// 묶는 순서 — 참여성부터 차례로, 그다음 다양성 (원장님 지시)
export const SECTIONS = [
  { key: 'counsel', store: 'counsel-wizard', area: '참여성', name: '부모 개별상담', pt: 5, build: buildCounselDoc },
  { key: 'committee', store: 'committee-wizard', area: '참여성', name: '어린이집 운영위원회', pt: 10, build: buildCommitteeDoc },
  { key: 'program', store: 'program-wizard', area: '참여성', name: '부모참여프로그램', pt: 5, build: buildProgramDoc },
  { key: 'survey', store: 'survey-wizard', area: '참여성', name: '부모만족도조사', pt: 10, build: buildSurveyDoc },
  { key: 'visit', store: 'visit-wizard', area: '참여성', name: '부모 어린이집 참관', pt: 5, build: buildVisitDoc },
  { key: 'link', store: 'link-wizard', area: '다양성', name: '연계·협력 활동', pt: 15, build: buildLinkDoc },
];

export const STORE_KEYS = SECTIONS.map((s) => s.store);

// 그 서류에 실제로 만든 내용이 있는지
export function sectionHasData(key, d) {
  if (!d) return false;
  if (key === 'counsel') return (d.rounds || []).some(counselHas);
  if (key === 'committee') return (d.meetings || []).some(meetingHasContent);
  if (key === 'program') return Object.values(d.months || {}).some(monthHasContent);
  if (key === 'survey') return !!(d.scores && Object.keys(d.scores).length) || !!d.noticeGreeting || !!d.need;
  if (key === 'visit') return !!(d.notice || d.policy || (d.logs || []).some((l) => l.date));
  if (key === 'link') return Object.values(d.acts || {}).some(actHasContent);
  return false;
}

export const emptyAll = () => ({
  year: '2026',
  goal: '', goalFeedback: '',
  extra: '',      // 연간일정에 손으로 더 넣을 내용
});

// ── 연간일정 (영역별로 구분해서 정리) ──
// 개방성은 서류가 아니라 상시 운영이라 '상시'로 적는다.
export function scheduleRows(all, docs) {
  const rows = [];
  const push = (area, item, when, note) => rows.push([area, item, when || '연중 상시', note || '']);

  // 개방성 — 상시 운영 (문서 없이 현장에서 확인)
  push('개방성', '보육실·공용공간 개방 (공간 개방성)', '연중 상시', '부모가 볼 수 있도록 상시 개방');
  push('개방성', '부모 공용 공간 운영', '연중 상시', '부모가 이용할 수 있는 공간 마련');
  push('개방성', '온라인 소통창구 게시', '월 1회 이상', '홈페이지·밴드 등에 직접 게시');

  // 참여성
  const cs = docs.counsel;
  if (cs) {
    (cs.rounds || []).forEach((r, i) => {
      if (!counselHas(r)) return;
      push('참여성', `부모 개별상담 ${i + 1}회차`, counselPeriod(r), '전체 재원 영유아 가정');
    });
  }
  const cm = docs.committee;
  if (cm) {
    (cm.meetings || []).forEach((m, i) => {
      if (!meetingHasContent(m)) return;
      push('참여성', `운영위원회 ${MEETINGS[i].no} (${MEETINGS[i].quarter})`, cmWhen(m) || MEETINGS[i].when, '');
    });
  }
  const pg = docs.program;
  if (pg) {
    monthList(pg.year || all.year).forEach((mi) => {
      const x = pg.months?.[mi.key];
      if (!monthHasContent(x)) return;
      push('참여성', `부모참여프로그램 - ${planOf(pg, mi.m).theme || mi.label}`, pgWhen(x) || mi.label, '');
    });
  }
  const sv = docs.survey;
  if (sv && (sv.from || (sv.scores && Object.keys(sv.scores).length))) {
    push('참여성', '부모만족도조사', svPeriod(sv) || `${sv.year || all.year}년`, '전체 부모 대상 연 1회');
  }
  const vs = docs.visit;
  if (vs) push('참여성', '부모 어린이집 참관', '연중 상시', '참관 안내문 상시 게시');

  // 다양성
  const lk = docs.link;
  if (lk) {
    Array.from({ length: lk.count || 4 }, (_, i) => i).forEach((i) => {
      const a = actOf(lk, i);
      if (!actHasContent(a)) return;
      const p = lkPlan(lk, i);
      push('다양성', `연계·협력 - ${a.title || p.title || `${i + 1}회`}`, lkWhen(a) || p.month, a.partner || p.partner || '');
    });
  }

  // 원장님이 손으로 더 넣은 줄
  String(all.extra || '').split(/\n+/).map((t) => t.trim()).filter(Boolean).forEach((line) => {
    const [area, item, when, note] = line.split('|').map((s) => (s || '').trim());
    if (item) rows.push([area || '기타', item, when || '', note || '']);
  });

  return rows;
}

// 연간일정 표 (문서와 화면에서 같은 것을 쓴다)
export function scheduleTable(all, docs) {
  return {
    type: 'table',
    cls: 'survey',
    head: ['구분', '내용', '시기', '비고'],
    widths: ['12%', '38%', '26%', '24%'],
    rows: scheduleRows(all, docs),
    leftFirst: true,
  };
}

// ── 표지 · 목표 · 연간일정 ──
export function frontBlocks(all, center, docs) {
  const y = all.year || '2026';
  return [
    { type: 'cover', year: y, center },
    { type: 'pagebreak' },
    { type: 'title', text: `${center}의 열린어린이집 운영 목표` },
    {
      type: 'para',
      text: all.goal
        || `${center}은 어린이집의 문을 열어 부모와 지역사회가 함께 아이를 기르는 열린어린이집을 지향합니다.\n`
        + `첫째, 보육실과 공용 공간을 부모에게 상시 개방하고 언제든 참관할 수 있도록 하여 어린이집 운영을 투명하게 공개합니다.\n`
        + `둘째, 개별상담·운영위원회·부모참여프로그램·만족도조사를 통해 부모의 의견을 정기적으로 듣고 운영에 반영합니다.\n`
        + `셋째, 이웃 어린이집·지역사회 기관과 연계한 활동을 정기적으로 운영하여 아이들의 경험을 넓히고 지역과 함께 자라는 어린이집이 되고자 합니다.\n`
        + `이 자료는 ${y}년 한 해 동안 위 목표에 따라 운영한 내용을 영역별로 정리한 것입니다.`,
    },
    { type: 'pagebreak' },
    { type: 'title', text: `${y}년도 ${center} 열린어린이집 연간일정` },
    scheduleTable(all, docs),
    { type: 'note', text: '※ 개방성 영역은 상시 운영으로 현장에서 확인하는 항목이며, 참여성·다양성 영역의 서류는 아래에 순서대로 정리하였습니다.' },
  ];
}

// ── 전체 문서 ──
// docs = { counsel: {...}, committee: {...}, ... } (각 서류를 만들 때 저장해 둔 내용)
export function buildAllDoc(all, basic, docs) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const blocks = [...frontBlocks(all, center, docs)];

  let n = 0;
  SECTIONS.forEach((s) => {
    const d = docs[s.key];
    if (!sectionHasData(s.key, d)) return;
    n += 1;
    blocks.push({ type: 'pagebreak' });
    // 배점은 문서에 넣지 않는다 (원장님 지시). 화면 목록에서만 보여 준다.
    blocks.push({ type: 'sectionhead', no: n, area: s.area, text: s.name });
    s.build(d, basic).forEach((b) => {
      // 각 서류의 맨 앞 제목은 이미 위에 큰 제목으로 넣었으므로 한 단계 낮춰 넣는다
      if (b.type === 'title') blocks.push({ type: 'heading', text: b.text });
      else blocks.push(b);
    });
  });

  if (!n) {
    blocks.push({ type: 'note', text: '※ 아직 만든 서류가 없습니다. 서류를 먼저 만든 뒤 다시 묶어 주세요.' });
  }
  return blocks;
}

// 화면 블록 → 한글(hwpx) 문단
export function toHwpxBlocks(blocks) {
  const out = [];
  const kv = (rows) => (rows || []).forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${String(v || '').replace(/\n/g, ' / ')}` }));
  blocks.forEach((b) => {
    if (b.type === 'cover') {
      out.push({ kind: 'title', text: `${b.year}년 ${b.center} 열린어린이집 관련 서류` });
      out.push({ kind: 'note', text: b.center });
    }
    else if (b.type === 'sectionhead') out.push({ kind: 'title', text: `${b.no}. [${b.area}] ${b.text}` });
    else if (b.type === 'title' || b.type === 'greenbar') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'lead') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'heading' || b.type === 'sessionhead' || b.type === 'subheading' || b.type === 'centertitle' || b.type === 'formtitle') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'kv') kv(b.rows);
    else if (b.type === 'checklist') (b.items || []).forEach((it) => out.push({ kind: 'body', text: `□ ${it.label} : ${String(it.value || '').replace(/\n/g, ' / ')}` }));
    else if (b.type === 'table') {
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.map((c) => (c && typeof c === 'object' ? c.t : c)).filter((x) => x !== null).join(' | ') }));
    }
    else if (b.type === 'rulesdoc') String(b.text || '').split('\n').forEach((t) => {
      const s = t.trim();
      if (s) out.push({ kind: /^제\s*\d+\s*장|^부칙/.test(s) ? 'head' : 'body', text: s });
    });
    else if (b.type === 'noticedoc') {
      out.push({ kind: 'head', text: b.title });
      if (b.greeting) out.push({ kind: 'body', text: b.greeting });
      kv(b.rows);
      if (b.closing) out.push({ kind: 'body', text: b.closing });
    }
    else if (b.type === 'minutesdoc') {
      out.push({ kind: 'head', text: b.title });
      kv(b.info);
      if (b.order) out.push({ kind: 'body', text: `[회의순서]\n${b.order}` });
      out.push({ kind: 'body', text: `[토의 및 의결사항]\n${b.discussion || ''}` });
      if (b.closing) out.push({ kind: 'body', text: b.closing });
      (b.signRows || []).forEach((r) => out.push({ kind: 'body', text: r.filter(Boolean).join(' : ') }));
    }
    else if (b.type === 'resultdoc') {
      out.push({ kind: 'head', text: b.title });
      if (b.intro) out.push({ kind: 'body', text: b.intro });
      (b.items || []).forEach((it, i) => {
        out.push({ kind: 'body', text: `${i + 1}) ${it.title}` });
        out.push({ kind: 'body', text: it.body || '' });
      });
      if (b.closing) out.push({ kind: 'body', text: b.closing });
    }
    else if (b.type === 'recorddoc') {
      out.push({ kind: 'head', text: b.title });
      kv(b.info);
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.join(' | ') }));
      (b.sections || []).filter((s) => s.text).forEach((s) => {
        out.push({ kind: 'head', text: s.title });
        out.push({ kind: 'body', text: s.text });
      });
    }
    else if (b.type === 'bars') {
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `${it.name} : ${Number(it.value || 0).toFixed(1)}점` }));
      if (b.total) out.push({ kind: 'body', text: `${b.total.name} : ${Number(b.total.value || 0).toFixed(1)}점` });
    }
    else if (b.type === 'resultnotes') {
      if (b.good) out.push({ kind: 'body', text: `[잘된 점]\n${b.good}` });
      if (b.improve) out.push({ kind: 'body', text: `[개선 의견]\n${b.improve}` });
      if (b.action) out.push({ kind: 'body', text: `[조치사항]\n${b.action}` });
    }
    else if (b.type === 'notice' || b.type === 'poster') {
      if (b.greeting || b.lead) out.push({ kind: 'body', text: b.greeting || b.lead });
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `${it.label} : ${String(it.value || '').replace(/\n/g, ' / ')}` }));
      (b.notes || []).forEach((t) => out.push({ kind: 'note', text: `※ ${t}` }));
    }
    else if (b.type === 'photos') out.push({ kind: 'note', text: `※ 사진 ${(b.items || []).filter(Boolean).length}장은 PDF 파일에 들어 있습니다.` });
    else if (b.type === 'sign') out.push({ kind: 'body', text: `${b.date || ''} ${b.role || ''} ${b.name || ''}`.trim() });
  });
  return out;
}
