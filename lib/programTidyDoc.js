// 부모참여프로그램 "기존 서류 정리" (②번 길)
// 원장님이 이미 가지고 있는 자료를 올려서 한 문서로 다시 정리한다.
//   ① 연간 운영계획 (PDF 등) 1개  → AI가 읽어 연간계획표로
//   ② 3월부터 진행한 월별(또는 분기별) 실시기록을 순서대로 → AI가 읽어 실시기록 서식으로
//      · 사진은 달마다 2장 이상 반드시 넣는다 (심사에서 사진이 없으면 실시 증빙이 약하다)
//      · '평가'는 올린 실시기록을 근거로 AI가 분석해 쓴다
//   ③ 전체 문서 = 필요성 → 연간계획표 → 달별 실시기록(+사진)
//
// ⚠️ 연간 운영계획 없이 실시기록만 있으면 5점이 아니라 2점만 인정된다. (2026 세부기준)

import {
  MONTH_SEQ, monthList, monthLabel, whenText,
  attendText, totalCount, flowList, planOf, rangeInfo, rangeTitle,
} from './programDoc';

export { RANGES, rangeInfo, rangeTitle, monthLabel, whenText, attendText, totalCount, flowList, monthList } from './programDoc';
export { toHwpxBlocks } from './programDoc';

// 달마다 반드시 넣어야 하는 사진 장수 (원장님 지시)
export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 4;

// 한 달치 (올린 자료 원문 + 분석 결과를 함께 보관)
export const emptyTidyMonth = () => ({
  // 올린 자료
  src: '', files: [],          // 실시기록 원문
  etcSrc: '', etcFiles: [],    // 공지문 등 참고 자료 (선택)
  photos: [],                  // 활동 사진 (2장 이상 필수)
  // AI가 읽어낸 것
  theme: '',                   // 프로그램명
  date: '', time: '', place: '', target: '',
  parents: '', kids: '', staff: '',
  flow: [],                    // [{time, content}]
  summary: '',                 // 진행내용
  review: '',                  // 평가 (AI 분석)
  missing: [],
  analyzed: false,
  analyzeFeedback: '',
  reviewFeedback: '',
});

export const emptyTidyData = () => ({
  year: '2026',
  // 연간 운영계획
  planSrc: '', planFiles: [], planMissing: [], planAnalyzed: false,
  plan: [],                    // [{m, theme, target, method, content}]
  planFeedback: '',
  // 최종 문서 앞머리
  need: '', needFeedback: '',
  months: {},                  // { '2026-03': {…} }
  // 전체 문서를 보고 고쳐 달라고 한 것
  reviseFeedback: '',
  reviseLog: [],
});

export const tidyMonthOf = (data, key) => data.months?.[key] || emptyTidyMonth();

// 프로그램 이름 — 실시기록에서 읽어낸 것을 먼저 쓰고, 없으면 연간계획의 주제를 쓴다
export const themeOf = (data, mi) => {
  const x = tidyMonthOf(data, mi.key);
  return x.theme || planOf(data, mi.m).theme || '';
};

export const monthTidyHasContent = (x) =>
  !!(x && (x.src?.trim() || x.date || flowList(x).length || (x.photos || []).length || x.summary));

// 사진 2장까지 갖춰야 '완성'으로 본다
export const monthTidyDone = (x) =>
  !!(x?.date && x?.summary && flowList(x).length && (x.photos || []).length >= MIN_PHOTOS);

export const photosShort = (x) => Math.max(0, MIN_PHOTOS - ((x?.photos || []).length));

// 문서에 넣을 달 = 무언가 올린 달 (열두 달을 다 채우지 않아도 된다)
export function chosenTidyMonths(data) {
  return monthList(data.year).filter((x) => monthTidyHasContent(data.months?.[x.key]));
}

export function rangeTidyMonths(data, rangeKey) {
  const picks = chosenTidyMonths(data);
  const r = rangeInfo(rangeKey);
  return r.months ? picks.filter((x) => r.months.includes(x.m)) : picks;
}

// ── 연간계획 표 ──
// 올린 계획서에 있는 달만 넣는다 (분기별로 운영한 원이면 빈 줄이 잔뜩 생기지 않도록)
export function planTidyBlocks(data) {
  const y = data.year || '2026';
  const rows = MONTH_SEQ
    .map((m) => ({ m, p: planOf(data, m) }))
    .filter(({ p }) => p.theme || p.content || p.target || p.method)
    .map(({ m, p }) => [monthLabel(y, m), p.theme || '', p.target || '', p.method || '', p.content || '']);

  if (!rows.length) {
    return [{ type: 'note', text: '※ 연간 운영계획을 아직 올리지 않았습니다. 계획 없이 실시기록만 있으면 5점이 아니라 2점만 인정되니 꼭 올려 주세요.' }];
  }
  return [{
    type: 'table',
    head: ['시기', '주제(프로그램명)', '대상', '운영 방법', '주요 내용'],
    widths: ['15%', '22%', '10%', '21%', '32%'],
    rows,
  }];
}

// ── 실시기록(결과보고서) 한 장 ──
export function recordTidyBlock(data, mi, center, opts = {}) {
  const x = tidyMonthOf(data, mi.key);
  const p = planOf(data, mi.m);
  return {
    type: 'recorddoc',
    tight: !!opts.tight,
    title: `${mi.label} 부모참여프로그램 실시기록 (결과보고서)`,
    info: [
      ['프로그램명', themeOf(data, mi)],
      ['운영 일시', whenText(x)],
      ['장 소', x.place || ''],
      ['대 상', x.target || p.target || ''],
      ['참석자', attendText(x)],
      ['참석 인원', totalCount(x) ? `${totalCount(x)}명` : ''],
    ],
    head: ['시간', '운영 내용'],
    widths: ['18%', '82%'],
    rows: flowList(x).length ? flowList(x).map((f) => [f.time || '', f.content || '']) : [['', '']],
    sections: [
      { title: '부모참여프로그램 진행내용', text: x.summary || '' },
      { title: '평가', text: x.review || '' },
    ].filter((s) => s.text),
    center,
  };
}

// 한 달 = 실시기록 + 사진
export function monthTidyBlocks(data, mi, center, opts = {}) {
  const x = tidyMonthOf(data, mi.key);
  const b = [];
  if (!opts.noHead) {
    b.push({ type: 'sessionhead', text: `${mi.label} · ${themeOf(data, mi) || '부모참여프로그램'}` });
  }
  b.push(recordTidyBlock(data, mi, center, opts));
  const photos = (x.photos || []).filter(Boolean);
  if (photos.length) {
    // 전체 문서에서는 사진을 조금 작게 넣는다 — 크게 넣으면 남은 자리에 못 들어가
    // 통째로 다음 쪽으로 밀려 앞 쪽이 텅 빈다. (달별로 따로 저장할 때는 원래 크기)
    b.push({ type: 'photos', small: !!opts.tight, items: photos, caption: `${mi.label} 부모참여프로그램 활동 사진` });
  } else {
    b.push({ type: 'note', text: '※ 활동 사진이 아직 들어 있지 않습니다. 사진 2장 이상을 넣어 주세요.' });
  }
  return b;
}

// 한 달만 미리보기 · 따로 저장
export function buildOneMonthTidy(data, mi, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  return [
    { type: 'title', text: `${center} 부모참여프로그램` },
    { type: 'lead', text: `${mi.label} · ${themeOf(data, mi) || '주제 미입력'}` },
    ...monthTidyBlocks(data, mi, center, { noHead: true }),
  ];
}

const DEFAULT_NEED =
  '부모참여프로그램은 부모가 어린이집의 놀이와 일과에 직접 참여하여 자녀의 생활 모습을 함께 보고, '
  + '어린이집 운영을 이해하며 신뢰를 쌓기 위해 운영한다. 부모와 교직원이 함께 활동하는 과정에서 가정과 어린이집이 '
  + '같은 방향으로 아이를 지원할 수 있으며, 참여 과정에서 나온 부모의 의견을 보육과정 운영에 반영한다.';

// ── 전체 문서 ──
// 제목 → 1. 필요성 → 2. 연간계획표 → 3. 달별 실시기록(+사진)
export function buildProgramTidyDoc(data, basic, rangeKey = 'all') {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2026';
  const r = rangeInfo(rangeKey);
  const picks = rangeTidyMonths(data, rangeKey);

  const blocks = [
    { type: 'title', text: `${center}의 부모참여프로그램${r.months ? ` (${r.label})` : ''}` },
    { type: 'lead', text: r.months ? rangeTitle(data, rangeKey) : `${y}년 3월 ~ ${Number(y) + 1}년 2월` },
    { type: 'heading', text: '1. 부모참여프로그램의 필요성' },
    { type: 'para', text: data.need || DEFAULT_NEED },
    { type: 'heading', text: `2. ${y}년도 부모참여프로그램 연간계획` },
    ...planTidyBlocks(data),
    { type: 'note', text: '※ 어린이집이 수립한 연간 운영계획에 따라 부모참여프로그램을 운영하고, 그 결과를 아래와 같이 기록하였습니다.' },
    { type: 'heading', text: `3. ${r.months ? `${r.label} ` : ''}실시기록 (운영일시 · 참석자 · 운영내용 · 사진)` },
  ];

  if (!picks.length) {
    blocks.push({
      type: 'note',
      text: r.months
        ? `※ ${r.label}에 정리한 달이 없습니다. 달 목록에서 ${r.months.join('·')}월 자료를 먼저 올려 주세요.`
        : '※ 아직 정리한 달이 없습니다. 3월부터 차례로 실시기록을 올려 주세요.',
    });
    return blocks;
  }

  // 달 사이는 새 쪽으로 나누지 않고 점선으로만 구분한다 (중간 공백보다 이어짐이 중요 — 원장님 지시)
  picks.forEach((mi, i) => {
    if (i > 0) blocks.push({ type: 'divider' });
    monthTidyBlocks(data, mi, center, { tight: true }).forEach((x) => blocks.push(x));
  });
  return blocks;
}
