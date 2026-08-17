// ②번 길(기존 서류 정리)로 만든 서류를 한 권으로 묶는 문서
// 표지 → 목차 → 참여성 서류 → 다양성 서류 → 지자체 서류
// 각 서류는 그 서류를 만들 때 저장해 둔 내용을 그대로 가져와 쓴다.
// ⚠️ 큰 단락(서류)이 바뀌는 자리에서만 쪽을 나눈다 — 서류 안의 작은 번호는 이어 붙인다. (원장님 확정 규칙)

import { getDoc } from './docs';
import { buildCommitteeDoc, meetingHasContent } from './committeeDoc';
import { buildProgramTidyDoc, chosenTidyMonths } from './programTidyDoc';
import { buildSurveyTidyDoc, tidyHasContent as surveyHas } from './surveyTidyDoc';
import { buildVisitTidyDoc, tidyHasContent as visitHas } from './visitTidyDoc';
import { buildLinkTidyDoc, tidyHasContent as linkHas } from './linkTidyDoc';
import { buildLocalTidyDoc, tidyHasContent as localHas } from './localTidyDoc';

// 부모 개별상담은 아직 예전 방식(DocForm)이라 그 문서 정의의 build를 쓴다
function buildCounselTidy(saved) {
  const doc = getDoc('counsel');
  if (!doc) return [];
  return doc.build(saved?.values || {}, saved?.ai || null);
}

const counselHas = (d) => {
  const v = d?.values || {};
  return Object.entries(v).some(([k, x]) => k !== 'centerName' && (Array.isArray(x) ? x.length : String(x || '').trim()));
};

// 묶는 순서 — 참여성부터 차례로, 그다음 다양성, 마지막에 지자체 (원장님 지시)
export const SECTIONS = [
  { key: 'counsel', store: 'counsel', docId: 'counsel', area: '참여성', name: '부모 개별상담', build: buildCounselTidy, has: counselHas },
  { key: 'committee', store: 'committee-tidy', docId: 'committee-tidy', area: '참여성', name: '어린이집 운영위원회', build: (d, b) => buildCommitteeDoc(d, b), has: (d) => (d?.meetings || []).some(meetingHasContent) },
  { key: 'program', store: 'program-tidy', docId: 'program-tidy', area: '참여성', name: '부모참여프로그램', build: (d, b) => buildProgramTidyDoc(d, b, 'all'), has: (d) => !!chosenTidyMonths(d || {}).length },
  { key: 'survey', store: 'survey-tidy', docId: 'survey-tidy', area: '참여성', name: '부모만족도조사', build: (d, b) => buildSurveyTidyDoc(d, b), has: surveyHas },
  { key: 'visit', store: 'visit-tidy', docId: 'visit-tidy', area: '참여성', name: '부모 어린이집 참관', build: (d, b) => buildVisitTidyDoc(d, b), has: visitHas },
  { key: 'link', store: 'link-tidy', docId: 'link-tidy', area: '다양성', name: '연계·협력 활동', build: (d, b) => buildLinkTidyDoc(d, b), has: linkHas },
  { key: 'local', store: 'local-tidy', docId: 'local-tidy', area: '지자체', name: '지자체 자체기준', build: (d, b) => buildLocalTidyDoc(d, b), has: localHas },
];

export const STORE_KEYS = SECTIONS.map((s) => s.store);

export const emptyAll = () => ({ year: '2026', goal: '', goalFeedback: '' });

// 마지막 쪽 나눔 이후에 제목만 남았으면 쪽을 나누지 않는다 (제목만 있는 빈 쪽 방지)
const HEAD_ONLY = ['sectionhead', 'heading', 'title', 'lead'];
function breakPage(out) {
  if (!out.length) return;
  let i = out.length - 1;
  while (i >= 0 && out[i].type !== 'pagebreak') {
    if (!HEAD_ONLY.includes(out[i].type)) { out.push({ type: 'pagebreak' }); return; }
    i -= 1;
  }
  // 마지막 쪽 나눔 이후가 전부 제목뿐이면 나누지 않는다
}

// 서류 안에 있던 쪽 나눔은 전체 문서에서는 점선으로 바꾼다 (중간 공백 방지)
const softenBreaks = (blocks) => blocks.map((b) => (b.type === 'pagebreak' ? { type: 'divider' } : b));

export function buildAllTidyDoc(all, docs, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = all?.year || '2026';
  const ready = SECTIONS.filter((s) => docs[s.key] && s.has(docs[s.key]));

  const out = [
    { type: 'cover', year: y, center },
    { type: 'pagebreak' },
    { type: 'title', text: `${center}의 열린어린이집 운영 목표` },
    {
      type: 'para',
      text: all?.goal
        || `${center}은 어린이집의 문을 열어 부모와 지역사회가 함께 아이를 기르는 열린어린이집을 지향합니다.\n`
        + `보육 환경과 일과를 부모에게 상시로 공개하고, 부모가 어린이집 운영에 직접 참여할 수 있는 통로를 마련하며, `
        + `지역사회 기관과 연계하여 아이들의 경험을 넓힙니다.\n`
        + `이를 위해 ${y}년도에 실시한 참여성·다양성 영역의 운영 내용을 아래와 같이 정리합니다.`,
    },
    { type: 'heading', text: '문서 차례' },
    {
      type: 'table',
      head: ['구분', '영역', '서류 이름'],
      widths: ['10%', '20%', '70%'],
      rows: ready.map((s, i) => [`${i + 1}`, s.area, s.name]),
      leftFirst: true,
    },
  ];

  if (!ready.length) {
    out.push({ type: 'note', text: '※ 아직 정리한 서류가 없습니다. 각 서류를 먼저 만들어 주세요.' });
    return out;
  }

  ready.forEach((s, i) => {
    breakPage(out);
    out.push({ type: 'sectionhead', area: s.area, no: i + 1, text: s.name });
    softenBreaks(s.build(docs[s.key], basic || {})).forEach((b) => out.push(b));
  });
  return out;
}

export function toHwpxBlocks(blocks) {
  const out = [];
  const kv = (rows) => (rows || []).forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${String(v || '').replace(/\n/g, ' / ')}` }));
  blocks.forEach((b) => {
    if (b.type === 'cover') out.push({ kind: 'title', text: String(b.title || '').replace(/\n/g, ' ') });
    else if (b.type === 'title') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'sectionhead') out.push({ kind: 'title', text: `[${b.area}] ${b.text}` });
    else if (b.type === 'lead') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'heading' || b.type === 'subheading' || b.type === 'sessionhead' || b.type === 'centertitle' || b.type === 'formtitle' || b.type === 'greenbar') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'blank') out.push({ kind: 'body', text: ' ' });
    else if (b.type === 'kv') kv(b.rows);
    else if (b.type === 'checklist') (b.items || []).forEach((it) => out.push({ kind: 'body', text: `□ ${it.label} : ${String(it.value || '').replace(/\n/g, ' / ')}` }));
    else if (b.type === 'table') {
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.map((c) => (c && typeof c === 'object' ? c.t : c) || '').join(' | ') }));
    }
    else if (b.type === 'rulesdoc') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'noticedoc' || b.type === 'minutesdoc' || b.type === 'resultdoc' || b.type === 'recorddoc') {
      out.push({ kind: 'head', text: b.title });
      if (b.greeting) out.push({ kind: 'body', text: b.greeting });
      if (b.intro) out.push({ kind: 'body', text: b.intro });
      kv(b.rows || b.info);
      (b.items || []).forEach((it) => { out.push({ kind: 'head', text: it.title }); out.push({ kind: 'body', text: it.body }); });
      (b.sections || []).forEach((s) => { out.push({ kind: 'head', text: s.title }); out.push({ kind: 'body', text: s.text }); });
      if (b.closing) out.push({ kind: 'body', text: b.closing });
    }
    else if (b.type === 'bars') {
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `${it.name} : ${Number(it.value || 0).toFixed(1)}점` }));
      if (b.total) out.push({ kind: 'body', text: `${b.total.name} : ${Number(b.total.value || 0).toFixed(1)}점` });
    }
    else if (b.type === 'resultnotes') {
      if (b.good) out.push({ kind: 'body', text: `[잘된 점]\n${b.good}` });
      if (b.improve) out.push({ kind: 'body', text: `[개선 의견]\n${b.improve}` });
      if (b.action) out.push({ kind: 'body', text: `[어린이집 조치사항]\n${b.action}` });
    }
    else if (b.type === 'notice' || b.type === 'poster') {
      if (b.greeting || b.lead) out.push({ kind: 'body', text: b.greeting || b.lead });
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `${it.label} : ${String(it.value || '').replace(/\n/g, ' / ')}` }));
      (b.notes || []).forEach((n) => out.push({ kind: 'note', text: `※ ${n}` }));
    }
    else if (b.type === 'photos' || b.type === 'pages' || b.type === 'images') {
      out.push({ kind: 'note', text: `※ 사진·서식 ${(b.items || []).filter(Boolean).length}장은 PDF 파일에 들어 있습니다.` });
    }
    else if (b.type === 'attachrow') {
      (b.cols || []).forEach((c) => out.push({ kind: 'note', text: `※ ${c.title} ${(c.items || []).filter(Boolean).length}장은 PDF 파일에 들어 있습니다.` }));
    }
    else if (b.type === 'sign') out.push({ kind: 'body', text: `${b.date || ''}   ${b.role || ''} ${b.name || ''}` });
  });
  return out;
}
