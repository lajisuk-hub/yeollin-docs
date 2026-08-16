// 연계·협력 활동 서류 — 연간계획 + 활동별 안내문·실시기록
// 심사 기준: 3. 다양성 (15점)
//   3-가. 어린이집 간 연계·협력 (10점) — 연 2회 이상
//   3-나. 부모참여활동 지역사회 연계 (5점) — 연 2회 이상, ⚠️ 부모가 함께 참여해야 인정(영유아만 대상은 미인정)
//   두 항목은 같은 활동으로 중복 인정될 수 있다.

// 2026 사업설명회 자료 기준 — 두 항목 모두 '서류제출' 항목이고, 계획·안내·실시·기록이 모두 있어야 한다.
export const TYPES = [
  {
    key: 'center', name: '어린이집 간 연계·협력', pt: 10, need: 2,
    hint: '관내(같은 시·군) 다른 어린이집과 공동 프로그램·행사·자원 공유',
    partnerLabel: '협력한 어린이집',
    must: '실시기록에 운영일시 · 협력한 어린이집명 · 연계 및 협력 운영 내용 · 안내문이 들어가야 합니다.',
  },
  {
    key: 'local', name: '부모참여활동 지역사회 연계', pt: 5, need: 2,
    hint: '관내(같은 시·군) 자원과 연계한 활동에 부모가 함께 참여',
    partnerLabel: '연계 기관',
    must: '실시기록에 운영일시 · 참여인원(부모 참석자 확인) · 관내 자원 연계 및 협력 내용 · 안내문이 들어가야 합니다.',
  },
];

// 두 항목 공통으로 갖춰야 하는 네 가지 (사업설명회 점검 항목)
export const CHECKPOINTS = [
  '연 2회 이상 운영이 계획되어 있는가 (연간계획)',
  '연 2회 이상 활동을 부모에게 안내하는가 (안내문)',
  '연 2회 이상 관내 자원과 연계하여 실시하는가',
  '연 2회 이상 실시기록이 있는가',
];

// 연계할 만한 곳 (고르면 연간계획 초안에 들어간다)
export const PARTNERS = [
  '이웃 어린이집', '구립 도서관', '소방서', '보건소', '경찰서',
  '주민센터', '경로당·노인복지관', '지역 아동센터', '가까운 공원·농장', '전통시장',
];

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function dateText(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

export const whenText = (x) => (x?.date ? `${dateText(x.date)}${x.time ? ` ${x.time}` : ''}` : '');

export const emptyAct = () => ({
  date: '', time: '', place: '',
  title: '',                    // 활동명
  partner: '',                  // 연계 대상
  types: [],                    // ['center','local'] — 인정받을 항목 (둘 다 가능)
  target: '영유아와 보호자',
  parents: '', kids: '', staff: '',
  memo: '',
  noticeGreeting: '', noticeNotes: [], noticeFeedback: '',
  flow: [], summary: '', recordFeedback: '',
  review: '', reviewFeedback: '',
  photos: [],
});

export const emptyData = () => ({
  year: '2026',
  count: 4,                     // 몇 번 할지 (기본 4회 = 유형별 2회씩)
  partners: [],                 // 고른 연계 대상
  partnerEtc: '',
  need: '', needFeedback: '',
  plan: [], planFeedback: '',   // [{i, month, title, partner, types, content}]
  acts: {},                     // { 0: {…}, 1: {…} }
  samples: { notice: '', record: '' },
});

export const actOf = (data, i) => data.acts?.[i] || emptyAct();
export const planOf = (data, i) => (data.plan || []).find((p) => p.i === i) || {};

export const flowList = (x) => (x?.flow || []).filter((f) => f && (f.time || f.content));

const num = (v) => Number(String(v || '').replace(/[^0-9]/g, '')) || 0;

export function attendText(x) {
  return [
    ['부모', num(x?.parents)],
    ['영유아', num(x?.kids)],
    ['교직원', num(x?.staff)],
  ].filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}명`).join(' · ');
}

export const totalCount = (x) => num(x?.parents) + num(x?.kids) + num(x?.staff);

// 활동명·연계 대상은 연간계획에서 미리 채워 두므로, '작성했다'의 기준에는 넣지 않는다
export const actHasContent = (x) => !!(x && (x.date || x.noticeGreeting || x.memo || flowList(x).length || (x.photos || []).length));
export const actDone = (x) => !!(x?.date && x?.title && x?.noticeGreeting && flowList(x).length && (x.types || []).length);
// 실제로 실시한 것으로 인정할 수 있는 활동 (심사 횟수는 이것만 센다)
export const actRecorded = (x) => !!(x?.date && flowList(x).length);

export const typeName = (k) => TYPES.find((t) => t.key === k)?.name || '';

// 유형별로 몇 번을 채웠는지 (심사 요건 확인용)
export function typeCounts(data) {
  const out = {};
  TYPES.forEach((t) => { out[t.key] = 0; });
  Object.values(data.acts || {}).forEach((a) => {
    if (!actRecorded(a)) return;   // 실시기록이 있는 활동만 센다
    (a.types || []).forEach((k) => { if (out[k] !== undefined) out[k] += 1; });
  });
  return out;
}

// ⚠️ 지역사회 연계는 부모가 참여해야 인정된다
export const localNeedsParents = (a) => (a.types || []).includes('local') && num(a.parents) === 0;

// ── 필요성 ──
export function needBlocks(data, center) {
  return [
    {
      type: 'para',
      text: data.need
        || `${center}은 어린이집이 지역사회 안에서 함께 자라는 기관이라는 생각으로 다른 어린이집·지역사회 기관과 연계하여 활동을 운영합니다.\n`
        + `이웃 어린이집과 프로그램과 자원을 나누면 아이들은 더 넓은 또래 관계를 경험하고, 교직원은 서로의 보육 경험을 배우며 보육의 질을 함께 높일 수 있습니다. `
        + `또한 도서관·소방서·보건소와 같은 지역사회 기관과 연계한 활동에 부모가 함께 참여하면, 아이들이 살아가는 마을을 부모와 어린이집이 같이 알아가고 `
        + `가정과 지역사회가 아이를 함께 기르는 경험을 쌓게 됩니다.\n`
        + `이러한 연계·협력 활동은 어린이집을 지역사회에 열어 두는 열린어린이집 운영의 중요한 부분이며, ${center}은 이를 연간 계획으로 세워 정기적으로 실시하고 그 결과를 기록으로 남기고 있습니다.`,
    },
  ];
}

// ── 연간계획 ──
export function planBlocks(data) {
  const rows = Array.from({ length: data.count || 4 }, (_, i) => {
    const p = planOf(data, i);
    const a = actOf(data, i);
    const types = (a.types?.length ? a.types : p.types || []).map(typeName).join(' · ');
    return [
      `${i + 1}회`,
      a.date ? dateText(a.date) : (p.month || ''),
      a.title || p.title || '',
      a.partner || p.partner || '',
      types,
      p.content || '',
    ];
  });
  return [
    {
      type: 'table',
      head: ['구분', '시기', '활동명', '연계 대상', '인정 항목', '주요 내용'],
      widths: ['8%', '14%', '22%', '16%', '19%', '21%'],
      rows,
    },
  ];
}

// ── 활동 한 건 = 안내문 + 실시기록 (+ 사진) ──
function noticeBlock(data, i, center) {
  const a = actOf(data, i);
  const p = planOf(data, i);
  const title = a.title || p.title || '연계·협력 활동';
  return {
    type: 'noticedoc',
    title: `${title} 안내`,
    greeting: a.noticeGreeting || '',
    rows: [
      ['활동명', title],
      ['연계 대상', a.partner || p.partner || ''],
      ['일 시', whenText(a)],
      ['장 소', a.place || ''],
      ['대 상', a.target || ''],
    ].filter(([, v]) => v),
    closing: (a.noticeNotes || []).filter(Boolean).join('\n'),
    center,
  };
}

function recordBlock(data, i, center) {
  const a = actOf(data, i);
  const p = planOf(data, i);
  const title = a.title || p.title || '연계·협력 활동';
  return {
    type: 'recorddoc',
    title: `${title} 실시기록`,
    info: [
      ['활동명', title],
      // 어린이집 간 연계는 '협력한 어린이집명'을, 지역사회 연계는 '연계 기관'을 적어야 인정된다
      [(a.types || []).includes('center') ? '협력한 어린이집' : '연계 기관', a.partner || p.partner || ''],
      ['인정 항목', (a.types || []).map(typeName).join(' · ')],
      ['운영 일시', whenText(a)],
      ['장 소', a.place || ''],
      ['참석자', attendText(a)],
      ['참석 인원', totalCount(a) ? `${totalCount(a)}명` : ''],
    ],
    head: ['시간', '활동 내용'],
    widths: ['18%', '82%'],
    rows: flowList(a).length ? flowList(a).map((f) => [f.time || '', f.content || '']) : [['', '']],
    sections: [
      { title: '연계·협력 활동 진행내용', text: a.summary || '' },
      { title: '평가', text: a.review || '' },
    ].filter((s) => s.text),
    center,
  };
}

export function actBlocks(data, i, center, opts = {}) {
  const a = actOf(data, i);
  const p = planOf(data, i);
  const b = [];
  if (!opts.noHead) {
    b.push({ type: 'sessionhead', text: `${i + 1}회 · ${a.title || p.title || '활동명 미입력'} (${whenText(a) || '일시 미입력'})` });
  }
  b.push({ type: 'subheading', text: '① 활동 안내문' });
  b.push(noticeBlock(data, i, center));
  b.push({ type: 'subheading', text: '② 실시기록' });
  b.push(recordBlock(data, i, center));
  const photos = (a.photos || []).filter(Boolean);
  if (photos.length) b.push({ type: 'photos', items: photos, caption: `${a.title || p.title || ''} 활동 사진` });
  return b;
}

// 한 건만 미리 보기
export function buildOneActDoc(data, i, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const a = actOf(data, i);
  const p = planOf(data, i);
  return [
    { type: 'title', text: `${center} 연계·협력 활동` },
    { type: 'lead', text: `${i + 1}회 · ${a.title || p.title || '활동명 미입력'} (${whenText(a) || '일시 미입력'})` },
    ...actBlocks(data, i, center, { noHead: true }),
  ];
}

// ── 최종 문서 ──
// 제목 → 1. 필요성 → 2. 연간계획 → 3. 활동별 자료 → 4. 인정 현황
export function buildLinkDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2026';
  const counts = typeCounts(data);
  const list = Array.from({ length: data.count || 4 }, (_, i) => i).filter((i) => actHasContent(actOf(data, i)));

  const blocks = [
    { type: 'title', text: `${center} 연계·협력 활동` },
    { type: 'lead', text: `${y}년도 · 다양성 영역 (어린이집 간 연계·협력 / 지역사회 연계)` },
    { type: 'heading', text: '1. 연계·협력 활동의 필요성' },
    ...needBlocks(data, center),
    { type: 'heading', text: `2. ${y}년도 연계·협력 활동 연간계획` },
    ...planBlocks(data),
    { type: 'heading', text: '3. 활동별 자료 (안내문 · 실시기록)' },
  ];

  if (!list.length) {
    blocks.push({ type: 'note', text: '※ 아직 작성한 활동이 없습니다. 연간계획을 세운 뒤 활동을 골라 안내문과 실시기록을 만들어 주세요.' });
  } else {
    list.forEach((i, n) => {
      if (n > 0) blocks.push({ type: 'divider' });
      actBlocks(data, i, center).forEach((x) => blocks.push(x));
    });
  }

  blocks.push({ type: 'heading', text: '4. 심사 항목별 실시 현황' });
  blocks.push({
    type: 'table',
    head: ['심사 항목', '배점', '필요 횟수', '실시 횟수', '충족 여부'],
    widths: ['34%', '12%', '16%', '16%', '22%'],
    rows: TYPES.map((t) => [
      t.name, `${t.pt}점`, `연 ${t.need}회 이상`, `${counts[t.key]}회`,
      counts[t.key] >= t.need ? '충족' : `${t.need - counts[t.key]}회 부족`,
    ]),
  });
  blocks.push({
    type: 'table',
    head: ['점검 항목', '이 문서에서 확인할 수 있는 곳'],
    widths: ['52%', '48%'],
    rows: [
      [CHECKPOINTS[0], '2. 연간계획'],
      [CHECKPOINTS[1], '3. 활동별 자료 - ① 활동 안내문'],
      [CHECKPOINTS[2], '3. 활동별 자료 - ② 실시기록 (연계 대상·활동 내용)'],
      [CHECKPOINTS[3], '3. 활동별 자료 - ② 실시기록 (운영일시·참석자·활동내용)'],
    ],
  });
  blocks.push({ type: 'note', text: '※ 한 활동이 두 항목의 요건을 모두 갖춘 경우 양쪽 항목으로 함께 인정됩니다.' });
  blocks.push({ type: 'note', text: '※ 연계 대상은 관내(같은 시·군)의 어린이집·기관이어야 하며, 지역사회 연계는 부모가 함께 참여한 활동만 인정됩니다.' });
  return blocks;
}

// 화면 블록 → 한글(hwpx) 문단
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
    else if (b.type === 'noticedoc') {
      out.push({ kind: 'head', text: b.title });
      if (b.greeting) out.push({ kind: 'body', text: b.greeting });
      kv(b.rows);
      if (b.closing) out.push({ kind: 'body', text: b.closing });
      if (b.center) out.push({ kind: 'note', text: b.center });
    }
    else if (b.type === 'recorddoc') {
      out.push({ kind: 'head', text: b.title });
      kv(b.info);
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.join(' | ') }));
      (b.sections || []).forEach((s) => {
        out.push({ kind: 'head', text: s.title });
        out.push({ kind: 'body', text: s.text });
      });
    }
    else if (b.type === 'photos') {
      out.push({ kind: 'note', text: `※ 활동 사진 ${b.items.filter(Boolean).length}장은 PDF 파일에 들어 있습니다.` });
    }
  });
  return out;
}
