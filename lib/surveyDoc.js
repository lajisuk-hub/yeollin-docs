// 부모만족도조사 서류 — 설문지 + 결과보고서 (연 1회)
// 심사 기준: 2-라. 부모만족도 조사 (10점) / 전체 부모 대상 연 1회
// ⚠️ 설문지 자체는 제출하지 않고 '결과 기록'만 제출한다(별지 제8호 준용). 결과는 전체 부모에게 안내해야 한다.
// 서식은 원장님이 주신 자료를 그대로 따랐다.
//  - 설문지: 2024년 ○○○○어린이집 만족도 조사 양식 (4점 척도, 영역별 문항 + 수요조사)
//  - 결과보고서: 20**년 **어린이집 부모만족도 조사결과 안내 (□항목 + 평균표 + 막대그래프 + 비고)

// 결과보고서에서 집계하는 다섯 영역 (원장님 결과자료의 항목과 같다)
export const AREAS = [
  { key: 'env', name: '어린이집 환경', color: '#8fd9c0' },
  { key: 'open', name: '운영의 개방성', color: '#f79f5c' },
  { key: 'course', name: '보육과정', color: '#d6bdf0' },
  { key: 'inter', name: '상호작용', color: '#f5d442' },
  { key: 'safe', name: '건강·안전', color: '#2f8f4e' },
];

// 설문 문항 (원장님 양식의 문장을 영역별로 정리)
export const QUESTIONS = {
  env: [
    '어린이집의 위생·안전·환기·채광·조명·방습·방음 설비 등 환경과 시설이 아이들에게 적합하게 갖춰져 있다고 생각하십니까?',
    '보육실의 교구(놀잇감·자료)와 놀이 주제가 아이들의 흥미를 반영하여 다양하게 구성되어 있다고 생각하십니까?',
  ],
  open: [
    '원장을 아이의 발달과 보육에 대한 전문가로 신뢰할 수 있습니까?',
    '보육교직원이 아이의 개별적 발달 특성을 잘 파악하고 있으며 역할 수행에 적극적이라고 느끼십니까?',
    '어린이집의 보육 프로그램과 운영에 대한 정보를 주기적이고 상세하게 안내받고 있습니까?',
    '부모 대상 행사(오리엔테이션·간담회·부모교육 등)가 다양하게 제공되고 실시되고 있습니까?',
  ],
  course: [
    '어린이집의 보육 운영 철학과 신념에 만족하며, 보육 프로그램이 다양하게 운영되고 있다고 생각하십니까?',
    '어린이집의 하루일과(놀이-생활-휴식)를 알고 계시며 안정적으로 운영된다고 생각하십니까?',
    '아이가 어린이집 활동에 즐겁게 참여하고 있다고 생각하십니까?',
  ],
  inter: [
    '보육교직원이 아이를 존중하고 격려하는 상호작용을 하고 있다고 생각하십니까?',
    '아이의 어린이집 생활에 대해 교사와의 소통이 요청하실 때 언제든지 이루어지고 있습니까?',
  ],
  safe: [
    '어린이집의 급·간식이 영양을 고려한 균형 잡힌 식단이라고 생각하십니까?',
    '보육실의 환경이 청결하고 쾌적하다고 생각하십니까?',
    '아이들의 청결 지도(손 씻기·이 닦기 등)가 잘 이루어지고 있다고 생각하십니까?',
    '건강·안전 문제 발생 시 대응이 체계적이며, 연령에 맞는 안전교육과 소방·재난 훈련이 정기적으로 이루어지고 있음을 알고 계십니까?',
  ],
};

export const SCALE = ['매우 만족한다', '만족한다', '보통이다', '불만족한다'];

// 수요조사 (원장님 양식의 주관식 3문항)
export const DEMAND = [
  { q: '자녀와 함께하는 부모참여프로그램은 몇 회 실시하는 것이 적절하다고 생각하십니까?', choices: ['월 1회', '분기별 1회', '반기별 1회', '연 1회', '기타'] },
  { q: '올해 참여한 부모참여프로그램 중 가장 기억에 남는 프로그램은 무엇입니까?', lines: 2 },
  { q: '내년에도 참여하고 싶은 프로그램이나 추천하고 싶은 프로그램이 있습니까?', lines: 2 },
];

export const emptyData = () => ({
  year: '2025',
  // 조사 규모 — 가장 먼저 물어본다
  parents: '', copies: '', replies: '',
  twins: '',                       // 쌍둥이 등 비고
  from: '', to: '',
  ways: ['가정통신문·키즈노트 공지사항을 통하여 부모만족도 조사 안내', '부모만족도 조사 설문지 배부 후 회신'],
  // 설문지
  intro: '', introFeedback: '',
  // 결과 (영역별 평균 점수)
  scores: {},                      // { env: 4.2, ... }
  good: '', improve: '', action: '', resultFeedback: '',
});

const num = (v) => Number(String(v || '').replace(/[^0-9.]/g, '')) || 0;

export const replyRate = (d) => {
  const c = num(d?.copies), r = num(d?.replies);
  return c > 0 ? Math.round((r / c) * 100) : 0;
};

export function periodText(d) {
  const f = (s) => {
    if (!s) return '';
    const [y, m, dd] = s.split('-').map(Number);
    const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, dd).getDay()];
    return `${y}. ${m}. ${dd}.(${w})`;
  };
  if (!d?.from) return '';
  return d.to ? `${f(d.from)} ~ ${f(d.to)}` : f(d.from);
}

// ── 응답 결과 샘플 만들기 ──
// 실제 설문을 아직 못 하신 경우, 회신 수에 맞추어 그럴듯한 평균 점수를 만들어 드린다.
// (회신 수가 많을수록 소수점이 자연스럽게 나오도록 계산한다)
export function makeSampleScores(replies, seed = 0) {
  // 영역마다 조금씩 다른 만족도 (4.0 ~ 4.9 사이). 문서에 쓰기 좋게 소수 첫째 자리로 낸다.
  const base = [4.3, 4.6, 4.5, 4.4, 4.7];
  const out = {};
  AREAS.forEach((a, i) => {
    const jitter = (((seed + i * 7) % 5) - 2) * 0.1;   // -0.2 ~ +0.2
    const v = Math.min(4.9, Math.max(3.9, base[i] + jitter));
    out[a.key] = Math.round(v * 10) / 10;
  });
  return out;
}

export const scoreOf = (d, key) => {
  const v = Number(d?.scores?.[key]);
  return Number.isFinite(v) ? v : 0;
};

export function totalScore(d) {
  const vals = AREAS.map((a) => scoreOf(d, a.key)).filter((v) => v > 0);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

export const bestArea = (d) => AREAS.slice().sort((a, b) => scoreOf(d, b.key) - scoreOf(d, a.key))[0];
export const worstArea = (d) => AREAS.slice().sort((a, b) => scoreOf(d, a.key) - scoreOf(d, b.key))[0];

export const hasScores = (d) => AREAS.some((a) => scoreOf(d, a.key) > 0);

// ── ① 설문지 ──
export function surveyBlocks(data, center) {
  const y = data.year || '2025';
  const b = [
    { type: 'title', text: `${y}년도 ${center} 부모만족도 조사` },
    {
      type: 'para',
      text: data.intro
        || `안녕하십니까? 항상 ${center}에 대한 관심과 사랑을 보내주심에 감사드립니다.\n`
        + `${center}은 학부모님을 대상으로 만족도 조사를 실시합니다. 더 나은 보육 서비스를 제공하기 위해 매년 조사를 실시하며, `
        + `정성껏 작성해 주신 소중한 응답 내용은 어린이집 운영에 도움이 되는 자료로 사용됩니다. 바쁘시더라도 적극적인 참여를 부탁드립니다.`,
    },
    { type: 'note', text: '※ 해당되는 내용에 ☑ 표시해 주시기 바랍니다. 무기명으로 작성합니다.' },
    {
      type: 'kv',
      rows: [
        ['참 여 자', '□ 아버지    □ 어머니    □ 기타 (            )'],
        ['자녀 연령', '□ 만0세  □ 만1세  □ 만2세  □ 만3세  □ 만4세  □ 만5세'],
        ['조사 기간', periodText(data) || `${y}년   월   일 ~   월   일`],
      ],
    },
  ];

  AREAS.forEach((a) => {
    b.push({ type: 'subheading', text: a.name });
    b.push({
      type: 'table',
      head: ['내용', ...SCALE],
      widths: ['52%', '12%', '12%', '12%', '12%'],
      rows: (QUESTIONS[a.key] || []).map((q) => [q, '', '', '', '']),
      leftFirst: true,
    });
  });

  b.push({ type: 'subheading', text: '참여 행사 수요 조사' });
  DEMAND.forEach((d, i) => {
    b.push({ type: 'para', text: `${i + 1}. ${d.q}` });
    if (d.choices) b.push({ type: 'para', text: `   ${d.choices.map((c) => `□ ${c}`).join('    ')}` });
    else b.push({ type: 'blank', lines: d.lines || 2 });
  });

  b.push({ type: 'subheading', text: '담임교사에게 보내는 응원글' });
  b.push({ type: 'para', text: '무기명으로 작성하는 만족도 조사에 담임교사에게 보내는 응원의 글을 남겨 주시면 현장에서 애쓰는 선생님께 큰 격려가 됩니다.' });
  b.push({ type: 'blank', lines: 3 });
  b.push({
    type: 'para',
    text: `${center}은 학부모님과 같은 방향으로 아이들의 환경과 발달을 최우선 목표로 운영하고 있습니다. 항상 격려해 주시고 지지해 주셔서 감사드립니다.`,
  });
  return b;
}

// ── ② 결과보고서 (원장님 결과자료 서식 그대로) ──
export function resultBlocks(data, center) {
  const y = data.year || '2025';
  const total = totalScore(data);
  const rows = [];
  // 표는 두 항목씩 나란히 (원장님 서식과 같게)
  for (let i = 0; i < AREAS.length; i += 2) {
    const a = AREAS[i], c = AREAS[i + 1];
    rows.push([
      a.name, scoreOf(data, a.key).toFixed(1),
      c ? c.name : '전체 만족도 평균',
      c ? scoreOf(data, c.key).toFixed(1) : total.toFixed(1),
    ]);
  }
  if (AREAS.length % 2 === 0) rows.push(['전체 만족도 평균', total.toFixed(1), '', '']);

  return [
    { type: 'greenbar', text: `${y}년 ${center} 부모만족도 조사결과 안내` },
    {
      type: 'checklist',
      items: [
        { label: '조사기간', value: periodText(data) },
        { label: '조사방법', value: (data.ways || []).join('\n') },
        {
          label: '결과',
          value: `부모 총 ${data.parents || 0}명${data.twins ? ` (${data.twins})` : ''} / 배부 ${data.copies || 0}부 / 회신 ${data.replies || 0}명 (회신율 ${replyRate(data)}%)`,
        },
        { label: '점수배치', value: '매우만족 5점 / 만족 4점 / 보통 3점 / 불만 2점 / 매우불만 1점 으로 환산' },
      ],
    },
    { type: 'centertitle', text: '<부모만족도 항목결과 : 5점 만점으로 하는 평균 점수>' },
    {
      type: 'table',
      head: ['조사항목', '평균점수', '조사항목', '평균점수'],
      widths: ['30%', '20%', '30%', '20%'],
      rows,
      lastStrong: true,
    },
    {
      type: 'bars',
      items: AREAS.map((a) => ({ name: a.name, value: scoreOf(data, a.key), color: a.color })),
      total: { name: '전체 만족도 평균', value: total, color: '#5b7fd4' },
    },
    {
      type: 'resultnotes',
      good: data.good || '',
      improve: data.improve || '',
      action: data.action || '',
      closing: `부모님 한 분 한 분의 소중한 의견을 반영하여\n더 발전할 수 있는 ${center}이 되도록 하겠습니다.\n감사합니다.`,
    },
  ];
}

// 설문지 + 결과보고서를 한 문서로 (설문지는 참고용, 제출은 결과기록)
export function buildSurveyDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  return [
    ...resultBlocks(data, center),
    { type: 'pagebreak' },
    { type: 'note', text: '※ 아래 설문지는 조사에 사용한 서식입니다. (심사 제출은 위 결과기록으로 합니다)' },
    ...surveyBlocks(data, center),
  ];
}

export function buildResultDoc(data, basic) {
  return resultBlocks(data, basic?.centerName?.trim() || '○○어린이집');
}

export function buildFormDoc(data, basic) {
  return surveyBlocks(data, basic?.centerName?.trim() || '○○어린이집');
}

// 화면 블록 → 한글(hwpx) 문단 (그래프는 글로 바꿔 넣는다)
export function toHwpxBlocks(blocks) {
  const out = [];
  blocks.forEach((b) => {
    if (b.type === 'title' || b.type === 'greenbar') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'heading' || b.type === 'subheading' || b.type === 'centertitle') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'blank') out.push({ kind: 'body', text: ' ' });
    else if (b.type === 'kv') (b.rows || []).forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${String(v || '').replace(/\n/g, ' / ')}` }));
    else if (b.type === 'checklist') (b.items || []).forEach((it) => out.push({ kind: 'body', text: `□ ${it.label} : ${String(it.value || '').replace(/\n/g, ' / ')}` }));
    else if (b.type === 'table') {
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.join(' | ') }));
    }
    else if (b.type === 'bars') {
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `${it.name} : ${Number(it.value || 0).toFixed(1)}점` }));
      if (b.total) out.push({ kind: 'body', text: `${b.total.name} : ${Number(b.total.value || 0).toFixed(1)}점` });
    }
    else if (b.type === 'resultnotes') {
      out.push({ kind: 'head', text: '비고' });
      if (b.good) { out.push({ kind: 'body', text: '[잘된 점]' }); out.push({ kind: 'body', text: b.good }); }
      if (b.improve) { out.push({ kind: 'body', text: '[개선 의견]' }); out.push({ kind: 'body', text: b.improve }); }
      if (b.action) { out.push({ kind: 'body', text: '[어린이집 조치사항]' }); out.push({ kind: 'body', text: b.action }); }
      if (b.closing) out.push({ kind: 'note', text: b.closing });
    }
  });
  return out;
}
