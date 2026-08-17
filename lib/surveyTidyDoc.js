// 부모만족도조사 "기존 서류 정리" (②번 길)
// 원장님이 지정한 순서:
//   1. 부모만족도 조사 공지 (업로드)
//   2. 조사 실시기간 (달력으로 작성)
//   3. 조사 내용 (업로드 — 응답이 많으면 ZIP으로 묶어서)
//   4. 분석한 결과자료로 정리 (항목별 점수 + 그래프)
//   5. 전체 문서로 정리
//
// 조사는 연 1회이므로 지난해(2025년) 자료를 올려 정리한다.
// 문서 서식은 ①번 길(lib/surveyDoc.js)의 것을 그대로 쓴다 — 원장님 결과자료 서식과 같다.

import {
  AREAS, emptyData, needBlocks, noticeBlocks, surveyBlocks, resultBlocks, planBlocksOf,
  scoreOf, totalScore, hasScores,
} from './surveyDoc';

export {
  AREAS, QUESTIONS, SCALE, periodText, replyRate, scoreOf, totalScore,
  bestArea, worstArea, hasScores, toHwpxBlocks,
} from './surveyDoc';

// 올린 자료 두 가지 (공지 / 조사 내용)
export const SRC_KINDS = [
  {
    k: 'notice',
    label: '부모만족도 조사 공지',
    hint: '조사 전에 부모님께 보낸 가정통신문·키즈노트 공지 등',
  },
  {
    k: 'content',
    label: '부모만족도 조사 내용',
    hint: '설문지와 회신된 응답 자료. 파일이 많으면 ZIP으로 묶어서 한 번에 올리세요.',
  },
];

export const emptyTidyData = () => ({
  ...emptyData(),
  year: '2025',
  // 올린 자료 원문
  src: { notice: '', content: '' },
  files: { notice: [], content: [] },
  skipped: { notice: [], content: [] },
  // 올린 설문지에서 읽어낸 문항 [{area, text}]
  questions: [],
  // 문항별 평균 점수 [{area, text, score}] — 자료에 있을 때만
  qScores: [],
  missing: { notice: [], content: [] },
  analyzed: { notice: false, content: false },
  noticeFeedback: '', resultFeedback: '',
  // 전체 문서를 보고 고쳐 달라고 한 것
  reviseFeedback: '', reviseLog: [],
});

// 예전에 저장된 것도 배열로 맞춘다
export const listOf = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

const areaName = (key) => AREAS.find((a) => a.key === key)?.name || '';

// 한 단계라도 했는지 / 다 됐는지
export const tidyHasContent = (d) =>
  !!(d?.src?.notice?.trim() || d?.src?.content?.trim() || d?.from || hasScores(d));

export const tidyDone = (d) => !!(d?.src?.notice?.trim() && d?.from && d?.to && hasScores(d));

// ── 문항별 평균 점수 표 (올린 자료에서 읽어냈을 때만) ──
export function qScoreBlocks(data) {
  const rows = (data.qScores || [])
    .filter((q) => q && q.text && Number(q.score) > 0)
    .map((q) => [areaName(q.area) || '기타', q.text, Number(q.score).toFixed(1)]);
  if (!rows.length) return [];
  return [
    {
      type: 'table',
      cls: 'survey',
      head: ['구분', '문항', '평균점수'],
      widths: ['16%', '68%', '16%'],
      rows,
      leftFirst: true,
    },
    { type: 'note', text: '※ 문항별 평균은 회신된 설문지의 응답을 5점 만점으로 환산하여 집계한 값입니다.' },
  ];
}

// ── 전체 문서 ──
// 제목 → 1.필요성 → 2.조사 공지문 → 3.조사 내용(설문지) → 4.결과서 → (5.문항별 상세) → 마지막. 내년 반영
export function buildSurveyTidyDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2025';
  const detail = qScoreBlocks(data);

  let n = 0;
  const head = (t) => ({ type: 'heading', text: `${(n += 1)}. ${t}` });

  const out = [
    { type: 'title', text: `${center} 학부모 만족도 조사` },
    { type: 'lead', text: `${y}년도 · 전체 학부모 대상 연 1회` },
    head('학부모 만족도 조사의 필요성'),
    ...needBlocks(data, center),
    head('학부모 만족도 조사 공지문'),
    ...noticeBlocks(data, center),
    head('학부모 만족도 조사 (설문지)'),
    ...surveyBlocks(data, center, { noTitle: true }),
    head('학부모 만족도 조사 결과서'),
    ...resultBlocks(data, center),
  ];

  if (detail.length) {
    out.push(head('문항별 상세 분석'));
    detail.forEach((b) => out.push(b));
  }

  out.push(head('결과 내용을 통한 내년 반영 내용'));
  planBlocksOf(data, center).forEach((b) => out.push(b));
  return out;
}

// 결과서 한 장만 (부모님께 나눠 주는 안내문)
export function buildTidyResultDoc(data, basic) {
  return resultBlocks(data, basic?.centerName?.trim() || '○○어린이집');
}

// 조사 공지문 한 장만
export function buildTidyNoticeDoc(data, basic) {
  return noticeBlocks(data, basic?.centerName?.trim() || '○○어린이집');
}

// AI에게 "지금 문서에 들어 있는 글"을 알려줄 때 쓰는 요약
export function docTextOf(data, center) {
  const scores = AREAS.map((a) => `${a.name} ${scoreOf(data, a.key).toFixed(1)}점`).join(' / ');
  return [
    `[필요성]\n${data.need || '(기본 문구)'}`,
    `[공지문 인사말]\n${data.noticeGreeting || '(기본 문구)'}`,
    `[공지문 맺음말]\n${data.noticeClosing || '(기본 문구)'}`,
    `[설문지 안내글]\n${data.intro || '(기본 문구)'}`,
    `[영역별 평균] ${scores} / 전체 ${totalScore(data).toFixed(1)}점`,
    `[잘된 점]\n${data.good || '(없음)'}`,
    `[개선 의견]\n${data.improve || '(없음)'}`,
    `[어린이집 조치사항]\n${data.action || '(없음)'}`,
    `[내년 반영 내용]\n${data.plan || '(기본 문구)'}`,
    `어린이집: ${center}`,
  ].join('\n\n');
}
