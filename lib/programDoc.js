// 부모참여프로그램 서류 — 기본사항 → 연간계획(월 1회) → 월별 공지문 + 실시기록 → 정리
// 심사 기준: 2-다. 부모참여프로그램 (5점) / 열린어린이집은 반기별 1회면 충족되지만
//            원장님 방침에 따라 월 1회로 계획을 세우고, 마지막에 분기별 1회만 낼지 월 1회 전부 낼지 고른다.
// ⚠️ 연간 운영계획 없이 실시기록만 있으면 5점이 아니라 2점만 인정된다.
// 실시기록에는 운영일시·참석자·운영내용이 모두 들어가야 한다.

// 어린이집 학년도 기준 3월 ~ 다음 해 2월
export const MONTH_SEQ = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];

// 분기 (열린어린이집은 분기별 1회면 충족)
export const QUARTERS = [
  { no: '1분기', months: [3, 4, 5] },
  { no: '2분기', months: [6, 7, 8] },
  { no: '3분기', months: [9, 10, 11] },
  { no: '4분기', months: [12, 1, 2] },
];

export const AGE_OPTIONS = ['만 0세', '만 1세', '만 2세', '만 3세', '만 4세', '만 5세'];
export const TARGET_OPTIONS = ['아빠', '엄마', '가족 모두', '조부모', '기타'];

// 그 달이 몇 년인지 (1·2월은 다음 해)
export const yearOf = (year, m) => (m <= 2 ? Number(year) + 1 : Number(year));
export const monthKey = (year, m) => `${yearOf(year, m)}-${String(m).padStart(2, '0')}`;
export const monthLabel = (year, m) => `${yearOf(year, m)}년 ${m}월`;
export const quarterOf = (m) => QUARTERS.find((q) => q.months.includes(m))?.no || '';

// 그 해의 12개월 목록
export function monthList(year) {
  return MONTH_SEQ.map((m) => ({
    m,
    key: monthKey(year, m),
    label: monthLabel(year, m),
    quarter: quarterOf(m),
  }));
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function dateText(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일(${w})`;
}

export function whenText(x) {
  if (!x?.date) return '';
  return `${dateText(x.date)}${x.time ? ` ${x.time}` : ''}`;
}

// 공지문 서식 그림 기본값 (원장님이 주신 그림. 없으면 글자만 있는 공지문으로 나온다)
export const DEFAULT_NOTICE_BG = '/program-notice-bg.png';
export const DEFAULT_TOP = 38;
// 서식 그림 아래쪽(약 79% 아래)에 잎사귀·색 덩어리 장식이 있어 글이 겹치지 않도록 여백을 둔다
export const DEFAULT_BOTTOM = 22;
// 예전에 기본값이던 아래 여백 — 저장해 둔 달이 있으면 새 기본값으로 자동으로 올려 준다
const OLD_BOTTOMS = [12];

export function upgradeMonth(x) {
  if (!x) return x;
  if (x.bg === DEFAULT_NOTICE_BG && OLD_BOTTOMS.includes(x.bottom)) return { ...x, bottom: DEFAULT_BOTTOM };
  return x;
}

export const emptyMonth = () => ({
  date: '', time: '', place: '어린이집 보육실',
  target: '',                 // 그 달 참여 대상 (아빠·엄마·가족 등)
  parents: '', kids: '', staff: '',
  // 공지문 — 일시·장소·대상·내용은 표(또는 항목)로 자동, 인사말과 참고사항만 AI
  noticeGreeting: '', noticeNotes: [], noticeFeedback: '',
  bg: DEFAULT_NOTICE_BG, top: DEFAULT_TOP, bottom: DEFAULT_BOTTOM, textScale: 1.15,
  // 실시기록
  memo: '', flow: [], summary: '', recordFeedback: '',
  review: '', reviewFeedback: '',
  photos: [],
});

export const emptyData = () => ({
  year: '2026',
  ages: [],                   // 어린이집 아이 연령
  past: '',                   // 지금까지 해 온 부모참여프로그램
  targets: [], targetEtc: '', // 희망하는 참여 대상
  need: '', needFeedback: '', // 부모참여프로그램의 필요성 (최종 문서 첫 장)
  plan: [],                   // 연간계획 12줄 [{m, theme, target, method, content}]
  planFeedback: '',
  months: {},                 // { '2026-03': {…} }
  mode: '',                   // '' | 'quarter'(분기별 1회) | 'month'(월 1회 전부)
  picked: [],                 // 분기별 1회로 낼 때 고른 달 key 4개
  samples: { notice: '', record: '' },
});

// 연간계획 기본 샘플 (AI를 부르기 전에도 표가 비어 보이지 않게)
export function defaultPlan(year, targets = []) {
  const t = (i) => (targets.length ? targets[i % targets.length] : '가족 모두');
  const rows = [
    ['입학·진급 축하 가족 놀이', '새 학기 적응을 돕는 가족 참여 놀이'],
    ['우리 가족 봄나들이', '어린이집 뜰과 동네를 함께 걷는 봄 산책'],
    ['가정의 달 감사 잔치', '어버이날·어린이날을 함께 기념하는 참여 활동'],
    ['아빠와 함께하는 놀이터', '아버지 참여 신체놀이 프로그램'],
    ['여름 물놀이 안전 교실', '부모와 함께하는 물놀이·안전 체험'],
    ['부모 참여 수업 (열린어린이집의 날)', '보육실 개방, 일과 참관과 함께하는 놀이'],
    ['가을 열매 요리 활동', '부모와 함께하는 요리 활동'],
    ['우리 아이 성장 나눔의 날', '작품 전시와 성장 이야기 나누기'],
    ['가족 운동회', '온 가족이 함께하는 신체 활동'],
    ['성탄 축하 가족 잔치', '겨울 축제와 소감 나눔'],
    ['새해 가족 놀이마당', '전통놀이와 새해 인사 나누기'],
    ['한 해를 마무리하는 성장 축하식', '1년 성장 되돌아보기와 졸업·수료 축하'],
  ];
  return MONTH_SEQ.map((m, i) => ({
    m,
    theme: rows[i][0],
    target: t(i),
    method: '어린이집 보육실 · 부모 참여 활동',
    content: rows[i][1],
  }));
}

// ── 실시기록 메모 샘플 ──
// 공지문에 적은 시간·주제·장소를 그대로 가져와 그날 진행 순서를 미리 적어 준다.
// (원장님은 이 틀 위에서 우리 원 이야기로 고치기만 하면 된다)
function parseStart(time) {
  const s = String(time || '');
  const m = s.match(/(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
  if (!m) return null;
  let h = Number(m[2]);
  const mm = Number(m[3] || 0);
  if (m[1] === '오후' && h < 12) h += 12;
  if (m[1] === '오전' && h === 12) h = 0;
  return h * 60 + mm;
}

const hhmm = (t) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

// 받침이 있으면 '과', 없으면 '와' (예: 아빠와 / 부모님과)
function gwa(word) {
  const c = String(word || '').trim().slice(-1);
  if (!c) return '와';
  const code = c.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '와';
  return code % 28 ? '과' : '와';
}

export function defaultMemo(x, p) {
  const start = parseStart(x?.time);
  const at = (add) => (start === null ? '' : `${hhmm(start + add)} `);
  const theme = p?.theme || '부모참여프로그램';
  const who = x?.target || p?.target || '부모님';
  const place = x?.place || '어린이집 보육실';
  return [
    `${at(0)}${who}${gwa(who)} 아이가 함께 등원, 이름표 달고 오늘 일정 안내`,
    `${at(20)}반별로 인사 나누기, 서로 소개하는 몸풀기 놀이`,
    `${at(40)}${theme} 활동 진행 - ${place}에서 반별로 함께 참여`,
    `${at(70)}보육실과 놀이 환경 함께 둘러보기, 궁금한 점 묻고 답하기`,
    `${at(90)}활동 소감 나누기, 마무리 인사`,
    '',
    '(부모님 반응) ',
    '(아쉬웠던 점 · 다음에 보완할 점) ',
  ].join('\n');
}

export const planOf = (data, m) => (data.plan || []).find((p) => p.m === m) || {};
export const monthOf = (data, key) => data.months?.[key] || emptyMonth();

export const flowList = (x) => (x?.flow || []).filter((f) => f && (f.time || f.content));

const num = (v) => Number(String(v || '').replace(/[^0-9]/g, '')) || 0;

// 0명으로 적은 항목은 문서에 넣지 않는다 (원장님 지시)
export function attendText(x) {
  return [
    ['부모', num(x?.parents)],
    ['영유아', num(x?.kids)],
    ['교직원', num(x?.staff)],
  ].filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}명`).join(' · ');
}

export function totalCount(x) {
  return num(x?.parents) + num(x?.kids) + num(x?.staff);
}

export function monthHasContent(x) {
  return !!(x && (x.date || x.noticeGreeting || x.memo || flowList(x).length || (x.photos || []).length));
}

// 공지문까지 + 실시기록까지 다 되었는지
export const noticeDone = (x) => !!(x?.date && x?.noticeGreeting);
export const monthDone = (x) => !!(noticeDone(x) && flowList(x).length);

// 최종 문서에 넣을 달 (분기별 1회면 고른 4개, 월 1회면 내용이 있는 달 전부)
export function chosenMonths(data) {
  const list = monthList(data.year);
  if (data.mode === 'quarter') return list.filter((x) => (data.picked || []).includes(x.key));
  return list.filter((x) => monthHasContent(data.months?.[x.key]));
}

// ── 문서를 구간별로 나눠 정리하기 (전체 / 분기별) ──
export const RANGES = [
  { key: 'all', label: '전체' },
  ...QUARTERS.map((q, i) => ({ key: `q${i + 1}`, label: `${q.no}`, months: q.months })),
];

export const rangeInfo = (key) => RANGES.find((r) => r.key === key) || RANGES[0];

// 그 구간에 들어가는 달 (문서에 넣기로 한 달 중에서)
export function rangeMonths(data, rangeKey) {
  const picks = chosenMonths(data);
  const r = rangeInfo(rangeKey);
  return r.months ? picks.filter((x) => r.months.includes(x.m)) : picks;
}

// 구간 이름 — 예) 1분기 (2026년 3월 ~ 5월)
export function rangeTitle(data, rangeKey) {
  const r = rangeInfo(rangeKey);
  if (!r.months) return '';
  const y = data.year || '2026';
  const labels = r.months.map((m) => monthLabel(y, m));
  return `${r.label} (${labels[0]} ~ ${labels[labels.length - 1].replace(/^\d+년\s*/, (s) => (labels[0].startsWith(s) ? '' : s))})`;
}

// ── 공지문 한 장 ── (마법사 미리보기에서도 그대로 쓴다)
export function noticeBlock(data, mi, center) {
  const x = monthOf(data, mi.key);
  const p = planOf(data, mi.m);
  const theme = p.theme || '부모참여프로그램';
  const items = [
    { label: '일시', value: whenText(x) || mi.label },
    { label: '장소', value: x.place || '' },
    { label: '대상', value: x.target || p.target || '전체 재원 영유아와 보호자' },
    // 계획표의 '주요 내용'은 ~한다 서술형이라 부모님께 보내는 글에는 어울리지 않는다.
    // 자세한 내용은 인사말에 들어가므로 여기에는 프로그램 이름만 적는다.
    { label: '내용', value: theme },
  ].filter((it) => it.value);
  const notes = (x.noticeNotes || []).filter(Boolean);

  if (x.bg) {
    return {
      type: 'notice',
      bg: x.bg, top: x.top ?? DEFAULT_TOP, bottom: x.bottom ?? DEFAULT_BOTTOM, textScale: x.textScale ?? 1.15,
      greeting: x.noticeGreeting || '',
      items, notes, center,
    };
  }
  return {
    type: 'noticedoc',
    title: `${mi.label} 부모참여프로그램 안내 — ${theme}`,
    greeting: x.noticeGreeting || '',
    rows: items.map((it) => [it.label, it.value]),
    closing: notes.join('\n'),
    center,
  };
}

// ── 실시기록(결과보고서) 한 장 ──
function recordBlock(data, mi, center) {
  const x = monthOf(data, mi.key);
  const p = planOf(data, mi.m);
  return {
    type: 'recorddoc',
    title: `${mi.label} 부모참여프로그램 실시기록 (결과보고서)`,
    info: [
      ['프로그램명', p.theme || ''],
      ['운영 일시', whenText(x)],
      ['장 소', x.place || ''],
      ['대 상', x.target || p.target || ''],
      ['참석자', attendText(x)],
      ['참석 인원', totalCount(x) ? `${totalCount(x)}명` : ''],
    ],
    head: ['시간', '운영 내용'],
    widths: ['18%', '82%'],
    rows: flowList(x).length ? flowList(x).map((f) => [f.time || '', f.content || '']) : [['', '']],
    // 진행내용과 평가를 나누어 보여 준다 (원장님 지시)
    sections: [
      { title: '부모참여프로그램 진행내용', text: x.summary || '' },
      { title: '평가', text: x.review || '' },
    ].filter((s) => s.text),
    center,
  };
}

// 한 달 = 공지문 + 결과보고서 (+ 사진) 한 세트
export function monthSetBlocks(data, mi, center, opts = {}) {
  const x = monthOf(data, mi.key);
  const p = planOf(data, mi.m);
  const b = [];
  if (!opts.noHead) {
    b.push({ type: 'sessionhead', text: `${mi.label} · ${p.theme || '부모참여프로그램'}` });
  }
  b.push({ type: 'subheading', text: '① 부모 안내문 (공지문)' });
  b.push(noticeBlock(data, mi, center));
  b.push({ type: 'subheading', text: '② 실시기록 (결과보고서)' });
  b.push(recordBlock(data, mi, center));
  const photos = (x.photos || []).filter(Boolean);
  if (photos.length) {
    b.push({ type: 'photos', items: photos, caption: `${mi.label} 부모참여프로그램 활동 사진` });
  }
  return b;
}

// 한 달만 미리 보기
export function buildOneMonthDoc(data, mi, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const p = planOf(data, mi.m);
  return [
    { type: 'title', text: `${center} 부모참여프로그램` },
    { type: 'lead', text: `${mi.label} · ${p.theme || '주제 미입력'}` },
    ...monthSetBlocks(data, mi, center, { noHead: true }),
  ];
}

// ── 연간계획 표 ──
export function planBlocks(data, center) {
  const y = data.year || '2026';
  const rows = MONTH_SEQ.map((m) => {
    const p = planOf(data, m);
    return [monthLabel(y, m), p.theme || '', p.target || '', p.method || '', p.content || ''];
  });
  return [
    {
      type: 'table',
      head: ['시기', '주제(프로그램명)', '대상', '운영 방법', '주요 내용'],
      widths: ['15%', '22%', '10%', '21%', '32%'],
      rows,
    },
  ];
}

// ── 최종 문서 ──
// 제목 → 1. 필요성 → 2. 연간계획 → 3. 월별 [공지문 + 결과보고서] 한 세트씩
export function buildProgramDoc(data, basic, rangeKey = 'all') {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2026';
  const picks = rangeMonths(data, rangeKey);
  const r = rangeInfo(rangeKey);
  const blocks = [
    { type: 'title', text: `${center}의 부모참여프로그램${r.months ? ` (${r.label})` : ''}` },
    { type: 'lead', text: r.months ? rangeTitle(data, rangeKey) : `${y}년 3월 ~ ${Number(y) + 1}년 2월` },
    { type: 'heading', text: '1. 부모참여프로그램의 필요성' },
    {
      type: 'para',
      text: data.need
        || `부모참여프로그램은 부모가 어린이집의 놀이와 일과에 직접 참여하여 자녀의 생활 모습을 함께 보고, `
        + `어린이집 운영을 이해하며 신뢰를 쌓기 위해 운영합니다. 부모와 교직원이 함께 활동하는 과정에서 가정과 어린이집이 `
        + `같은 방향으로 아이를 지원할 수 있으며, 참여 과정에서 나온 부모의 의견을 보육과정 운영에 반영합니다.`,
    },
    { type: 'heading', text: `2. ${y}년도 부모참여프로그램 연간계획` },
    ...planBlocks(data, center),
    {
      type: 'note',
      text: data.mode === 'quarter'
        ? '※ 연간계획은 월 1회로 세우고, 열린어린이집 선정 기준(분기별 1회)에 맞추어 분기마다 1회씩 선정하여 실시기록을 정리하였습니다.'
        : '※ 연간계획에 따라 매월 1회 부모참여프로그램을 운영하고 그 결과를 기록하였습니다.',
    },
    { type: 'heading', text: `3. ${r.months ? `${r.label} ` : ''}월별 운영 자료 (공지문 · 결과보고서)` },
  ];

  if (!picks.length) {
    blocks.push({
      type: 'note',
      text: r.months
        ? `※ ${r.label}에 작성한 달이 없습니다. 달 목록에서 ${r.months.join('·')}월 자료를 먼저 만들어 주세요.`
        : '※ 아직 작성한 달이 없습니다. 연간계획을 세운 뒤 달을 골라 공지문과 실시기록을 만들어 주세요.',
    });
    return blocks;
  }

  picks.forEach((mi, i) => {
    if (i > 0) blocks.push({ type: 'pagebreak' });
    monthSetBlocks(data, mi, center).forEach((x) => blocks.push(x));
  });
  return blocks;
}

// 화면 블록 → 한글(hwpx) 문단 (사진·서식 그림은 글로 바꿔 넣는다)
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
    else if (b.type === 'notice') {
      if (b.greeting) out.push({ kind: 'body', text: b.greeting });
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `${it.label} : ${it.value}` }));
      (b.notes || []).forEach((n) => out.push({ kind: 'note', text: `※ ${n}` }));
      if (b.center) out.push({ kind: 'note', text: b.center });
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
      (b.sections || []).filter((s) => s.text).forEach((s) => {
        out.push({ kind: 'head', text: s.title });
        out.push({ kind: 'body', text: s.text });
      });
    }
    else if (b.type === 'photos') {
      out.push({ kind: 'note', text: `※ 활동 사진 ${b.items.filter(Boolean).length}장은 PDF 파일에 들어 있습니다. 한글 문서에는 사진을 직접 붙여 넣어 주세요.` });
    }
  });
  return out;
}
