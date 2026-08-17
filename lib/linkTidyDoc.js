// 다양성(연계·협력) "기존 서류 정리" (②번 길)
// 원장님이 정한 순서:
//   ① 우리 원에 다양성 연간계획이 있는지 물어본다
//      · 있으면 → 연간계획 업로드 → AI가 읽어 회차 표로
//      · 없으면 → 활동을 직접 적어 두면 그것으로 '간이 연간'을 만들어 준다
//   ② 최소 충족 횟수를 안내한다 (어린이집 간 연 2회 / 지역사회 연계 연 2회)
//   ③ 회차마다 날짜(달력) · 행사이름 · 참여인원 · 참여명단 · 사진을 적는다
//   ④ 회차별 결과보고서를 업로드하면 AI가 진행내용·평가로 정리한다
//   ⑤ 전체 문서 = 1.필요성 2.연간 3.회차별 실행내역 4.전체내용평가

import { TYPES, dateText, whenText, typeName, PARTNERS } from './linkDoc';

export { TYPES, dateText, whenText, typeName, PARTNERS } from './linkDoc';

const num = (v) => Number(String(v || '').replace(/[^0-9]/g, '')) || 0;

export const emptyAct = () => ({
  date: '', time: '', place: '',
  title: '',            // 행사이름
  partner: '',          // 지역사회·인근기관
  types: [],            // ['center','local']
  parents: '', kids: '', staff: '',
  names: '',            // 참여명단
  photos: [],
  // 결과보고서
  src: '', files: [],
  summary: '', review: '',
  missing: [], analyzed: false, feedback: '',
});

export const emptyTidyData = () => ({
  year: '2026',
  hasPlan: null,        // null=아직 안 고름 / true=연간 있음 / false=없음
  // 올린 연간계획
  planSrc: '', planFiles: [], planMissing: [], planAnalyzed: false,
  planRows: [],         // [{i, when, title, partner, types[], content}]
  planFeedback: '',
  acts: [emptyAct(), emptyAct()],
  need: '', needFeedback: '',
  overall: '', overallFeedback: '',
  reviseFeedback: '', reviseLog: [],
});

export const listOf = (v) => (Array.isArray(v) ? v : (v ? [v] : []));
export const actAt = (d, i) => (d.acts || [])[i] || emptyAct();

export function attendText(x) {
  return [
    ['부모', num(x?.parents)],
    ['영유아', num(x?.kids)],
    ['교직원', num(x?.staff)],
  ].filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}명`).join(' · ');
}
export const totalCount = (x) => num(x?.parents) + num(x?.kids) + num(x?.staff);

export const actHasContent = (a) => !!(a && (a.date || a.title || a.src?.trim() || (a.photos || []).length));
// 실제로 실시한 것으로 인정할 수 있는 활동만 횟수에 센다
export const actRecorded = (a) => !!(a?.date && a?.title && (a.summary || a.src?.trim()));
export const actDone = (a) => !!(actRecorded(a) && (a.types || []).length && (a.photos || []).length);

// ⚠️ 지역사회 연계는 부모가 함께 참여해야 인정된다
export const localNeedsParents = (a) => (a.types || []).includes('local') && num(a.parents) === 0;

// 유형별 충족 횟수
export function typeCounts(data) {
  const out = {};
  TYPES.forEach((t) => { out[t.key] = 0; });
  (data.acts || []).forEach((a) => {
    if (!actRecorded(a)) return;
    (a.types || []).forEach((k) => { if (out[k] !== undefined) out[k] += 1; });
  });
  return out;
}

export const allTypesMet = (data) => {
  const c = typeCounts(data);
  return TYPES.every((t) => c[t.key] >= t.need);
};

export const tidyHasContent = (d) => !!(d && (d.hasPlan !== null || d.planSrc?.trim() || (d.acts || []).some(actHasContent)));
export const tidyDone = (d) => !!(d && allTypesMet(d));

// ── 연간계획 표 ──
// 연간이 있으면 올린 연간 그대로, 없으면 적어 둔 활동으로 만든 '간이 연간'
export function planRowsOf(data) {
  if (data.hasPlan && (data.planRows || []).length) {
    return data.planRows.map((p, i) => ({
      no: `${i + 1}회`,
      when: p.when || '',
      title: p.title || '',
      partner: p.partner || '',
      types: (p.types || []).map(typeName).join(' · '),
      content: p.content || '',
    }));
  }
  return (data.acts || []).filter(actHasContent).map((a, i) => ({
    no: `${i + 1}회`,
    when: a.date ? dateText(a.date) : '',
    title: a.title || '',
    partner: a.partner || '',
    types: (a.types || []).map(typeName).join(' · '),
    content: a.summary ? String(a.summary).split(/[.\n]/)[0].trim() : '',
  }));
}

export function planBlocks(data) {
  const rows = planRowsOf(data);
  if (!rows.length) {
    return [{ type: 'note', text: '※ 연간계획이 아직 비어 있습니다. 연간계획을 올리시거나 활동을 적어 주시면 여기에 표로 들어갑니다.' }];
  }
  const out = [{
    type: 'table',
    head: ['구분', '시기', '활동명', '연계 대상', '인정 항목', '주요 내용'],
    widths: ['8%', '16%', '22%', '16%', '19%', '19%'],
    rows: rows.map((r) => [r.no, r.when, r.title, r.partner, r.types, r.content]),
  }];
  if (!data.hasPlan) {
    out.push({
      type: 'note',
      text: '※ 위 연간계획은 실제 실시한 연계·협력 활동을 정리하여 작성한 것입니다.',
    });
  }
  return out;
}

// ── 회차별 실행내역 ──
export function actBlocks(data, i, center, opts = {}) {
  const a = actAt(data, i);
  const b = [];
  if (!opts.noHead) {
    b.push({ type: 'sessionhead', text: `${i + 1}회 · ${a.title || '활동명 미입력'} (${whenText(a) || '일시 미입력'})` });
  }
  b.push({
    type: 'recorddoc',
    tight: !!opts.tight,
    title: `${a.title || '연계·협력 활동'} 실시기록`,
    info: [
      ['활동명', a.title || ''],
      // 어린이집 간 연계는 '협력한 어린이집명'을, 지역사회 연계는 '연계 기관'을 적어야 인정된다
      [(a.types || []).includes('center') ? '협력한 어린이집' : '연계 기관', a.partner || ''],
      ['인정 항목', (a.types || []).map(typeName).join(' · ')],
      ['운영 일시', whenText(a)],
      ['장 소', a.place || ''],
      ['참석자', attendText(a)],
      ['참석 인원', totalCount(a) ? `${totalCount(a)}명` : ''],
      ['참여 명단', a.names || ''],
    ].filter(([, v]) => v),
    head: ['구분', '내용'],
    widths: ['22%', '78%'],
    rows: [['', '']],
    noFlow: true,
    sections: [
      { title: '연계·협력 활동 진행내용', text: a.summary || '' },
      { title: '평가', text: a.review || '' },
    ].filter((s) => s.text),
    center,
  });
  const photos = (a.photos || []).filter(Boolean);
  if (photos.length) {
    b.push({ type: 'photos', small: !!opts.tight, items: photos, caption: `${a.title || ''} 활동 사진` });
  }
  return b;
}

const DEFAULT_NEED = (center) =>
  `${center}은 어린이집이 지역사회 안에서 함께 자라는 기관이라는 생각으로 다른 어린이집·지역사회 기관과 연계하여 활동을 운영합니다.\n`
  + `이웃 어린이집과 프로그램과 자원을 나누면 아이들은 더 넓은 또래 관계를 경험하고, 교직원은 서로의 보육 경험을 배우며 보육의 질을 함께 높일 수 있습니다. `
  + `또한 도서관·소방서·보건소와 같은 지역사회 기관과 연계한 활동에 부모가 함께 참여하면, 아이들이 살아가는 마을을 부모와 어린이집이 같이 알아가고 `
  + `가정과 지역사회가 아이를 함께 기르는 경험을 쌓게 됩니다.\n`
  + `이러한 연계·협력 활동은 어린이집을 지역사회에 열어 두는 열린어린이집 운영의 중요한 부분이며, ${center}은 이를 연간 계획으로 세워 정기적으로 실시하고 그 결과를 기록으로 남기고 있습니다.`;

// ── 전체 문서 ──
// 1. 필요성 → 2. 연간 → 3. 회차별 실행내역 → 4. 전체내용평가
export function buildLinkTidyDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2026';
  const list = (data.acts || []).map((_, i) => i).filter((i) => actHasContent(actAt(data, i)));

  const out = [
    { type: 'title', text: `${center} 연계·협력 활동` },
    { type: 'lead', text: `${y}년도 · 다양성 영역 (어린이집 간 연계·협력 / 지역사회 연계)` },
    { type: 'heading', text: '1. 연계·협력 활동의 필요성' },
    { type: 'para', text: data.need || DEFAULT_NEED(center) },
    { type: 'heading', text: `2. ${y}년도 연계·협력 활동 연간계획` },
    ...planBlocks(data),
    { type: 'heading', text: '3. 회차별 실행내역' },
  ];

  if (!list.length) {
    out.push({ type: 'note', text: '※ 아직 정리한 활동이 없습니다. 활동을 적고 결과보고서를 올려 주세요.' });
  } else {
    list.forEach((i, n) => {
      if (n > 0) out.push({ type: 'divider' });
      actBlocks(data, i, center, { tight: true }).forEach((x) => out.push(x));
    });
  }

  out.push({ type: 'heading', text: '4. 전체 내용 평가' });
  out.push({ type: 'para', text: data.overall || '※ 전체 내용 평가를 아직 쓰지 않았습니다.' });
  return out;
}

// AI에게 넘길 "지금 문서에 들어 있는 글"
export function docTextOf(data) {
  return [
    `[필요성]\n${data.need || '(기본 문구)'}`,
    ...(data.acts || []).map((a, i) => `[${i}회차 · ${a.title || '무제'}]\n진행내용: ${a.summary || '(없음)'}\n평가: ${a.review || '(없음)'}`),
    `[전체 내용 평가]\n${data.overall || '(없음)'}`,
  ].join('\n\n');
}

export function toHwpxBlocks(blocks) {
  const out = [];
  const kv = (rows) => (rows || []).forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${String(v || '').replace(/\n/g, ' / ')}` }));
  blocks.forEach((b) => {
    if (b.type === 'title') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'lead') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'heading' || b.type === 'sessionhead' || b.type === 'subheading') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'kv') kv(b.rows);
    else if (b.type === 'table') {
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.join(' | ') }));
    }
    else if (b.type === 'recorddoc') {
      out.push({ kind: 'head', text: b.title });
      kv(b.info);
      (b.sections || []).forEach((s) => {
        out.push({ kind: 'head', text: s.title });
        out.push({ kind: 'body', text: s.text });
      });
    }
    else if (b.type === 'photos') {
      out.push({ kind: 'note', text: `※ 활동 사진 ${(b.items || []).filter(Boolean).length}장은 PDF 파일에 들어 있습니다.` });
    }
  });
  return out;
}
