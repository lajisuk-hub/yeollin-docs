// 부모 어린이집 참관 서류 — 게시용 안내문 + 상시 운영 계획 + 신청서·참관록
// 심사 기준: 2-마. 부모 어린이집 참관 (5점) / 참여성 / ⚠️ 서류제출이 아니라 '현장확인' 항목
// 2026 사업설명회 자료 점검 항목:
//   ① 부모가 직접 방문하여 보육환경·보육내용을 상시 참관할 수 있는가
//   ② 부모가 확인 가능한 곳에 참관 안내문이 게시되어 있는가
//   ③ 안내문에 참관 자격 · 시기 및 방법이 포함되어 있는가
//   ★ 상시 운영 여부는 면담으로 확인 (평정기간 내 연 1회 이상)
//   KEY WORD: 상시운영 / 참관은 외부에서 지켜보는 것 / 제한된 운영은 금물 / 신입원아 적응은 적응일 뿐

export const CHECKPOINTS = [
  '부모가 어린이집을 직접 방문하여 보육환경과 보육내용을 상시 참관할 수 있는가',
  '부모가 확인할 수 있는 곳에 참관 안내문이 게시되어 있는가',
  '참관 안내문에 참관 자격 · 시기 및 방법이 들어 있는가',
];

export const KEYWORDS = [
  { t: '상시 운영', d: '특정 기간·요일로 제한하지 않고 연중 언제든 참관할 수 있어야 합니다.' },
  { t: '참관은 지켜보는 것', d: '수업에 함께 참여하는 활동이 아니라, 평소 모습을 조용히 지켜보는 것입니다.' },
  { t: '제한된 운영은 금물', d: '매월 ○주만, 특정 반만처럼 조건을 걸면 상시 운영으로 보지 않습니다.' },
  { t: '신입 원아 적응은 별개', d: '적응기간 중 부모 동반은 참관 운영 실적으로 인정되지 않습니다.' },
];

export const emptyLog = () => ({ date: '', parent: '', cls: '', from: '', to: '', content: '' });

// 게시문 서식 그림 (원장님이 주신 그림). 그림에 제목이 이미 인쇄되어 있어 글만 얹는다.
export const DEFAULT_BG = '/visit-bg.png';
// 글 칸을 넓게 잡아야 글자가 커진다 (칸이 좁으면 자동 맞춤이 글자를 도로 줄인다)
export const DEFAULT_TOP = 20;
// 그림 아래쪽 약 75% 지점부터 잔디·건물 그림이 있어 그보다 위에서 끝나게 한다
export const DEFAULT_BOTTOM = 25;
export const DEFAULT_SCALE = 1.1;

// 예전에 기본값이던 조합 — 저장해 둔 값이 이것이면 새 기본값으로 올려 준다
const OLD_DEFAULTS = [
  { top: 25, bottom: 26, textScale: 1.15 },
  { top: 24, bottom: 30, textScale: 0.95 },
  { top: 22, bottom: 29, textScale: 1.1 },
];

export function upgradeVisit(d) {
  if (!d) return d;
  const old = OLD_DEFAULTS.some((o) => o.top === d.top && o.bottom === d.bottom && Math.abs((d.textScale ?? 0) - o.textScale) < 0.001);
  if (!old) return d;
  return { ...d, top: DEFAULT_TOP, bottom: DEFAULT_BOTTOM, textScale: DEFAULT_SCALE };
}

export const emptyData = () => ({
  year: '2026',
  // 게시문에 들어갈 기본 사항
  who: '재원 영유아의 보호자 (조부모 등 주 양육자 포함)',
  when: '연중 상시 (어린이집 운영시간 내 언제든지)',
  hours: '오전 9:30 ~ 오후 4:30',
  place: '각 반 보육실 및 공용 공간',
  how: '참관을 원하시는 날 어린이집으로 연락 주시면 바로 안내해 드립니다.',
  contact: '',
  notice: '', noticeFeedback: '',     // 게시문 인사말·안내 문구
  cautions: [],                        // 게시문 유의사항
  // 게시문 서식 그림
  bg: DEFAULT_BG, top: DEFAULT_TOP, bottom: DEFAULT_BOTTOM, textScale: DEFAULT_SCALE,
  policy: '', policyFeedback: '',      // 상시 운영 방침(면담 대비)
  logs: [emptyLog()],                  // 실제 참관 기록
});

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export function dateText(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

export const logList = (data) => (data.logs || []).filter((l) => l && (l.date || l.parent || l.content));

// ── ① 게시용 참관 안내문 (벽에 붙이는 한 장) ──
// opts.narrow — 전체 문서에 넣을 때는 그림을 조금 좁혀 앞 내용에 이어 붙게 한다
//                (그림이 쪽 높이를 다 차지하면 통째로 다음 쪽으로 밀려 앞 쪽이 텅 빈다)
export function posterBlocks(data, center, opts = {}) {
  const y = data.year || '2026';
  const items = [
    { label: '참관 자격', value: data.who },
    { label: '참관 시기', value: `${data.when}${data.hours ? `\n(참관 가능 시간 : ${data.hours})` : ''}` },
    { label: '참관 장소', value: data.place },
    { label: '참관 방법', value: `${data.how}${data.contact ? `\n(연락처 : ${data.contact})` : ''}` },
  ].filter((it) => it.value);
  const notes = (data.cautions || []).filter(Boolean).length
    ? data.cautions.filter(Boolean)
    : [
      '참관은 아이들의 평소 모습을 조용히 지켜보는 것으로, 활동에 직접 참여하지는 않습니다.',
      '아이들이 놀이에 집중할 수 있도록 참관 중에는 조용히 관찰해 주시기 바랍니다.',
      '참관 중 알게 된 다른 아이의 정보는 외부에 이야기하지 말아 주세요.',
    ];

  // 원장님 서식 그림이 있으면 그림 위에 글만 얹는다 (그림에 제목이 이미 인쇄되어 있음)
  if (data.bg) {
    return [{
      type: 'notice',
      bg: data.bg,
      top: data.top ?? DEFAULT_TOP,
      bottom: data.bottom ?? DEFAULT_BOTTOM,
      textScale: data.textScale ?? DEFAULT_SCALE,
      airy: true,   // 게시용이라 줄간격을 넓게
      narrow: !!opts.narrow,
      greeting: data.notice
        || `${center}은 언제나 열려 있습니다.\n`
        + `우리 아이가 어떤 환경에서 어떻게 지내는지 부모님께서 직접 오셔서 보실 수 있도록\n`
        + `연중 상시로 참관을 운영하고 있습니다.`,
      items, notes, center,
    }];
  }

  return [
    {
      type: 'poster',
      title: '어린이집 참관 안내',
      lead: data.notice
        || `${center}은 언제나 열려 있습니다.\n`
        + `우리 아이가 어떤 환경에서 어떻게 지내는지 부모님께서 직접 오셔서 보실 수 있도록\n`
        + `연중 상시로 참관을 운영하고 있습니다.`,
      items, notes, center, year: y,
    },
  ];
}

// ── ② 참관 상시 운영 계획 (면담 대비 · 원 보관용) ──
export function policyBlocks(data, center) {
  const y = data.year || '2026';
  return [
    { type: 'para', text: '□ 목적' },
    {
      type: 'para',
      text: data.policy
        || `${center}은 부모가 어린이집의 보육환경과 보육내용을 직접 보고 확인할 수 있도록 어린이집 참관을 연중 상시로 운영합니다. `
        + `참관은 어린이집 운영을 투명하게 공개하고 부모의 신뢰를 얻는 가장 기본적인 방법이며, 열린어린이집이 지향하는 개방적인 운영의 출발점입니다.\n`
        + `${center}은 참관을 특정 기간이나 특정 요일로 제한하지 않으며, 부모가 원하는 때에 언제든지 참관할 수 있도록 상시 운영합니다.`,
    },
    { type: 'para', text: '□ 법적 근거 : 「열린어린이집 선정·운영 기준」(교육부) 참여성 - 부모 어린이집 참관' },
    { type: 'para', text: '□ 운영 원칙' },
    {
      type: 'para',
      text: '① 참관은 연중 상시로 운영하며, 기간·요일·반을 제한하지 않는다.\n'
        + '② 참관을 원하는 보호자가 연락하면 당일에도 참관할 수 있도록 안내한다.\n'
        + '③ 참관 안내문을 현관과 각 반 게시판 등 보호자가 확인할 수 있는 곳에 상시 게시한다.\n'
        + '④ 참관은 아이들의 일과를 방해하지 않는 범위에서 관찰하는 방식으로 운영한다.\n'
        + '⑤ 참관 후에는 참관록을 작성하여 보관하고, 참관 중 나온 의견은 운영에 반영한다.',
    },
    {
      type: 'kv',
      rows: [
        ['참관 자격', data.who || ''],
        ['참관 시기', data.when || ''],
        ['참관 가능 시간', data.hours || ''],
        ['참관 장소', data.place || ''],
        ['참관 방법', data.how || ''],
        ['담당', `${center} 원장`],
      ].filter(([, v]) => v),
    },
    { type: 'para', text: '□ 유의사항' },
    {
      type: 'para',
      text: '· 참관은 활동에 참여하는 것이 아니라 평소 모습을 지켜보는 것으로 안내한다.\n'
        + '· 신입 원아의 적응기간 중 부모 동반은 적응 지원이므로 참관 운영과 구분하여 기록한다.\n'
        + '· 참관 중 알게 된 다른 영유아의 정보는 비밀을 유지하도록 사전에 안내한다.',
    },
    { type: 'note', text: `※ ${y}년도 ${center} 참관 운영은 위 계획에 따라 연중 상시로 운영합니다.` },
  ];
}

// ── ③ 참관 신청서 (빈 양식) ──
export function applyBlocks(data, center) {
  return [
    { type: 'formtitle', text: `${center} 참관 신청서` },
    { type: 'para', text: '아래 내용을 적어 담임교사 또는 원으로 알려 주시면 참관을 안내해 드립니다. 당일 신청도 가능합니다.' },
    {
      type: 'kv',
      tall: true,
      rows: [
        ['영유아 이름 / 반', ''],
        ['참관 희망일', '        년      월      일        시      분 ~       시      분'],
        ['참관하시는 분', '                    (영유아와의 관계 :               )'],
        ['연락처', ''],
        ['특별히 보고 싶은 부분', ''],
      ],
    },
    { type: 'note', text: '※ 참관은 아이들의 일과를 지켜보는 시간입니다. 활동에 함께 참여하지는 않는 점 양해 부탁드립니다.' },
    { type: 'sign', blank: true, role: '신청인' },
  ];
}

// ── ④ 참관록 (실시 기록) ──
export function logBlocks(data, center) {
  const list = logList(data);
  const rows = (list.length ? list : Array.from({ length: 4 }, () => emptyLog())).map((l, i) => [
    String(i + 1),
    l.date ? dateText(l.date) : '',
    l.parent || '',
    l.cls || '',
    l.from || l.to ? `${l.from || ''} ~ ${l.to || ''}` : '',
    l.content || '',
  ]);
  return [
    { type: 'centertitle', text: `${data.year || '2026'}년도 ${center} 어린이집 참관 기록` },
    {
      type: 'table',
      head: ['번호', '참관일', '참관자', '반', '시간', '참관 내용 및 의견'],
      widths: ['6%', '18%', '12%', '10%', '16%', '38%'],
      rows,
      leftFirst: true,
    },
    { type: 'note', text: '※ 참관 후 참관자의 의견을 함께 적어 두면 운영 개선 자료로 활용할 수 있습니다.' },
  ];
}

// ── 전체 문서 ──
export function buildVisitDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2026';
  return [
    { type: 'title', text: `${center} 부모 어린이집 참관 운영` },
    { type: 'lead', text: `${y}년도 · 연중 상시 운영` },
    { type: 'heading', text: '1. 참관 상시 운영 계획' },
    ...policyBlocks(data, center),
    { type: 'heading', text: '2. 게시용 참관 안내문' },
    { type: 'note', text: '※ 아래 안내문은 현관·각 반 게시판 등 보호자가 확인할 수 있는 곳에 상시 게시합니다. (심사 시 현장에서 확인합니다)' },
    ...posterBlocks(data, center, { narrow: true }),
    { type: 'heading', text: '3. 참관 신청서 (양식)' },
    ...applyBlocks(data, center),
    { type: 'heading', text: '4. 참관 기록' },
    ...logBlocks(data, center),
  ];
  // ※ 심사 점검 항목표는 문서에 넣지 않는다 (원장님 지시). 앱 화면에서만 안내한다.
}

export function buildPosterDoc(data, basic) {
  return posterBlocks(data, basic?.centerName?.trim() || '○○어린이집');
}

export function toHwpxBlocks(blocks) {
  const out = [];
  blocks.forEach((b) => {
    if (b.type === 'title') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'lead') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'heading' || b.type === 'subheading' || b.type === 'centertitle' || b.type === 'formtitle') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'kv') (b.rows || []).forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${String(v || '').replace(/\n/g, ' / ')}` }));
    else if (b.type === 'table') {
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.join(' | ') }));
    }
    else if (b.type === 'poster') {
      out.push({ kind: 'head', text: b.title });
      if (b.lead) out.push({ kind: 'body', text: b.lead });
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `${it.label} : ${String(it.value || '').replace(/\n/g, ' / ')}` }));
      (b.notes || []).forEach((n) => out.push({ kind: 'note', text: `※ ${n}` }));
      if (b.center) out.push({ kind: 'note', text: b.center });
    }
    else if (b.type === 'sign') out.push({ kind: 'body', text: `${b.date}   ${b.role} ${b.name}` });
  });
  return out;
}
