// 어린이집 운영위원회 서류 (회칙 + 1~4차 공지문·회의록·결과공지문)
// 심사 기준: 2-나. 어린이집 운영위원회 (10점) / 분기별 1회
// 분기는 어린이집 회계연도 기준 — 1분기 3월, 2분기 6~8월, 3분기 9~11월, 4분기 12~2월
// 심사는 직전 1년을 보므로 25년 4분기부터 26년 3분기까지 네 번을 1~4차로 정리한다.

// year = 어린이집 회계연도(3월 시작), qn = 그 회계연도의 몇 번째 분기인지
export const MEETINGS = [
  { no: '1차', quarter: '2025년 4분기', year: '2025', qn: 4, when: '2025년 12월 ~ 2026년 2월' },
  { no: '2차', quarter: '2026년 1분기', year: '2026', qn: 1, when: '2026년 3월', note: '1분기는 3월 안에 열어야 인정됩니다' },
  { no: '3차', quarter: '2026년 2분기', year: '2026', qn: 2, when: '2026년 6월 ~ 8월' },
  { no: '4차', quarter: '2026년 3분기', year: '2026', qn: 3, when: '2026년 9월 ~ 11월' },
];

// 원장님 서식 제목 표기 — 예) 2025년도 4/4분기
export const qLabel = (i) => `${MEETINGS[i].year}년도 ${MEETINGS[i].qn}/4분기`;

// 결과 안내문 제목 표기 — 예) 2026-2월  (실제로 회의를 연 달 기준)
export function noticeMonthLabel(m, i) {
  if (!m?.date) return qLabel(i);
  const [y, mo] = m.date.split('-').map(Number);
  return `${y}-${mo}월`;
}

export const YEARS = ['2025', '2026'];

// 운영위원 구분 (영유아보육법 시행령 기준 구성)
export const MEMBER_ROLES = ['원장', '보육교사 대표', '학부모 대표', '지역사회 인사'];

export const emptyMeeting = () => ({
  date: '', time: '', place: '어린이집 회의실',
  absent: [],           // 불참한 위원 이름
  guests: '',           // 그 밖의 참석자
  secretary: '',        // 간사
  agenda: '',           // 안건 (줄바꿈으로 여러 개)
  notice: '', noticeFeedback: '',            // 개최 공지문
  memo: '',                                  // 원장이 적은 논의·결정 메모
  // 회의록 — 원장님 서식대로 '회의순서'와 '토의 및 의결사항'으로 나눈다
  order: '', discussion: '', minutesFeedback: '',
  result: '', resultFeedback: '',            // 결과 공지문
  feature: '', featureFeedback: '',          // 그 분기 운영의 특징 정리
  photos: [],
});

export const emptyData = () => ({
  members: { 2025: [], 2026: [] },
  rules: { 2025: { text: '', feedback: '' }, 2026: { text: '', feedback: '' } },
  // 원장님이 가진 서식을 한 번만 붙여넣으면 네 차수 모두 그 틀로 만든다
  samples: { rules: '', notice: '', minutes: '', result: '' },
  meetings: MEETINGS.map(() => emptyMeeting()),
});

// 기본사항(교직원)에서 위원 명단 초안 만들기
export function suggestMembers(basic) {
  const staff = basic?.staff || [];
  const out = [];
  const director = staff.find((s) => s.role === '원장');
  if (director?.name) out.push({ name: director.name, role: '원장' });
  const teacher = staff.find((s) => s.role !== '원장' && s.name);
  if (teacher?.name) out.push({ name: teacher.name, role: '보육교사 대표' });
  out.push({ name: '', role: '학부모 대표' });
  out.push({ name: '', role: '학부모 대표' });
  out.push({ name: '', role: '지역사회 인사' });
  return out;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function dateText(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  const w = WEEK[new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일(${w})`;
}

export function whenText(m) {
  if (!m?.date) return '';
  return `${dateText(m.date)}${m.time ? ` ${m.time}` : ''}`;
}

export const agendaList = (m) =>
  String(m?.agenda || '').split(/\n+/).map((t) => t.trim().replace(/^\d+[.)]\s*/, '')).filter(Boolean);

export function meetingHasContent(m) {
  return !!(m && (m.date || m.agenda || m.notice || m.memo || m.discussion || m.result || (m.photos || []).length));
}

// 그 차수에 실제로 참석한 위원 (그 해의 명단에서)
export function membersOf(data, i) {
  return (data?.members?.[MEETINGS[i].year] || []).filter((x) => x.name?.trim());
}

export function presentMembers(members, m) {
  const absent = m?.absent || [];
  return (members || []).filter((x) => x.name && !absent.includes(x.name));
}

export function attendText(members, m) {
  const names = presentMembers(members, m).map((x) => `${x.name}(${x.role})`);
  if (m?.guests?.trim()) names.push(m.guests.trim());
  return names.join(', ');
}

// 회의록 표의 '참석현황' — 원장님 서식대로 구분별로 줄을 나눈다
export function attendLines(members, m) {
  const p = presentMembers(members, m);
  const by = (role) => p.filter((x) => x.role === role).map((x) => x.name).join(', ');
  const lines = [
    `▪ 학부모위원 : ${by('학부모 대표')}`,
    `▪ 보육교사위원 : ${by('보육교사 대표')}`,
    `▪ 지역위원 : ${by('지역사회 인사')}`,
    `▪ 원장 : ${by('원장')}`,
  ].filter((s) => !s.endsWith(': '));
  if (m?.guests?.trim()) lines.push(`▪ 그 밖의 참석자 : ${m.guests.trim()}`);
  return lines.join('\n');
}

// 회의록 맨 아래 서명란 (운영위원장 · 운영위원 · 교사위원 · 원장)
export function signRows(members) {
  const rows = [];
  const parents = members.filter((x) => x.role === '학부모 대표');
  const locals = members.filter((x) => x.role === '지역사회 인사');
  parents.forEach((x, i) => rows.push([i === 0 ? '운영위원장' : `운영위원${i}`, x.name, '']));
  locals.forEach((x, i) => rows.push([`운영위원(지역)${locals.length > 1 ? i + 1 : ''}`, x.name, '']));
  members.filter((x) => x.role === '보육교사 대표').forEach((x) => rows.push(['교사위원', x.name, '']));
  members.filter((x) => x.role === '원장').forEach((x) => rows.push(['원장', x.name, '']));
  return rows.length ? rows : [['', '', '']];
}

// 그 차수에 필요한 것이 다 채워졌는지
export function meetingDone(m) {
  return !!(m?.date && m?.agenda && m?.notice && m?.discussion && m?.result);
}

// 회의록 마지막 줄 — 원장님 서식은 다음 분기 회의 시기를 예고하고 맺는다
export function closingText(i) {
  const cur = MEETINGS[i].qn;
  const nextQn = cur === 4 ? 1 : cur + 1;
  const whenHint = { 1: '3월경', 2: '7~8월경', 3: '10~11월경', 4: '1~2월경' }[nextQn];
  return `이상으로 ${cur}/4분기 어린이집 운영위원회를 마치도록 하겠습니다. `
    + `다음 ${nextQn}/4분기 회의는 ${whenHint}에 진행할 예정입니다. 감사합니다.`;
}

// 분기마다 실제로 많이 올라오는 안건 샘플 (원장님 어린이집 회의록에서 뽑음)
// 화면에 미리 채워 두고 원장님이 고치거나 더하도록 한다.
export function defaultAgenda(i) {
  const { year, qn } = MEETINGS[i];
  const y = Number(year);
  return {
    1: [
      '운영위원 위촉 및 위원장 선출',
      `${y - 1}년 기타필요경비·특별활동비 정산보고 건`,
      `${y - 1}년 결산보고, ${y}년 예산보고 건`,
      `${y}년 어린이집 운영 수요도 조사 결과 건`,
      `${y}년 어린이집 행사편성 건`,
      '기타 안건',
    ],
    2: [
      `${y}년 상반기(3월~6월) 운영보고`,
      '상반기 부모참여수업 건',
      '하반기 부모참여 및 행사 건',
      '기타 안건',
    ],
    3: [
      `${y}년 하반기 운영보고`,
      '상반기 부모만족도 조사 결과 건',
      '보육환경 개선 및 시설 안전점검 건',
      '기타 안건',
    ],
    4: [
      `${y}년 12월 ~ ${y + 1}년 2월 어린이집 운영보고`,
      `${y + 1}년 특별활동 변경 건`,
      `${y + 1}년 기타필요경비 건`,
      `${y}년 하반기 부모만족도 조사 건`,
      '기타 안건',
    ],
  }[qn].join('\n');
}

// 분기마다 실제로 오가는 이야기 샘플 (원장님 어린이집 회의록에서 뽑음)
// 안건과 같은 순서로 적어 두어, 우리 원 이야기로 고쳐 쓰기 쉽게 한다.
export function defaultMemo(i) {
  const { year, qn } = MEETINGS[i];
  const y = Number(year);
  return {
    1: [
      `운영위원 위촉 및 위원장 선출 - 올해 운영위원을 위촉하고, 위원장은 ○○○ 위원이 과반수 찬성으로 선출됨`,
      `${y - 1}년 정산보고 - 기타필요경비 집행률 ○○% 확인하고 서명함. 특별활동비도 함께 정산 보고`,
      `${y - 1}년 결산·${y}년 예산 - 결산과 예산 내용을 보고함. 운영위원 동의함`,
      `${y}년 운영 수요도 조사 결과 - 운영시간 오전 ○시 ~ 오후 ○시. 근로자의 날 휴원. 하계·동계 교직원 집중휴가는 사전공지대로 진행. 운영위원 동의함`,
      `${y}년 행사편성 - 입학식·진급식, 어린이날, 어버이날, 여름캠프, 부모참여수업, 명절, 성탄절, 졸업수료식 등 결정. 운영위원 동의함`,
      '기타 안건 - 급식은 키즈노트에 매일 공개. CCTV 열람은 절차에 따라 원내에서만. 보육교직원 권익보호(휴게시간·연차·인권) 준수 중',
    ],
    2: [
      `${y}년 상반기(3월~6월) 운영보고 - 영아 발달수준에 맞춰 프로그램을 계획하고 다양한 경험을 하도록 진행함. 부모참여활동을 확대함. 에어컨 세척, LED 교체 등 환경을 보완함. 운영위원이 알림장으로 아이 생활을 알 수 있어 만족한다고 함`,
      '상반기 부모참여수업 - 장소는 ○○○으로 결정. 점심은 각자 해결하고 오후에 등원. 프로그램은 2시간 내외로 편성. 운영위원이 부모에게 충분히 안내해 달라고 함',
      `하반기 부모참여 및 행사 - 9월 운동회 장소가 정해지면 11월 말 진행 예정. 10월 졸업사진 촬영, 12월 성탄절 행사, 1월 부모오리엔테이션, ${y + 1}년 2월 졸업수료식 예정`,
      `기타 안건 - 8월경 상반기 만족도 조사를 하고 결과는 3분기 운영위원회에서 논의. 동계 집중연차는 ${y}년 12월 말 2~3일 예정. 질식사고 예방을 위해 식단에서 떡 삭제`,
    ],
    3: [
      `${y}년 하반기 운영보고 - 하반기 보육과정과 행사 진행 내용을 보고함. 운영위원이 ○○에 대해 의견을 줌`,
      '상반기 부모만족도 조사 결과 - 응답률 ○○%. 만족도가 높았던 부분과 개선이 필요한 부분을 보고하고, 개선 계획을 안내함',
      '보육환경 개선 및 안전점검 - 시설 안전점검 결과와 보완할 부분을 보고함. 운영위원 동의함',
      '기타 안건 - 겨울철 감염병 예방과 난방·환기 계획을 안내함',
    ],
    4: [
      `${y}년 12월 ~ ${y + 1}년 2월 운영보고 - 분기 동안 다양한 프로그램을 편성해 진행함. 현장학습과 계절 행사를 연결해 운영함. 운영위원이 기타필요경비 대비 다양한 활동이라 만족한다고 함`,
      `${y + 1}년 특별활동 변경 - ${y + 1}년부터 과목 하나를 변경함. 샘플수업 결과 아이들의 호기심이 높아 결정함. 운영위원이 만족한다고 함`,
      `${y + 1}년 기타필요경비 - 행사비·선물비 인상으로 부족한 실정. 특별활동 과목 변경에 따라 매월 납부액 인상 예정. 단가는 인원비율(1/n) 구조`,
      `${y}년 하반기 부모만족도 조사 - 일정이 늦어져 네이버폼으로 진행 중이며 결과는 추후 공지 예정`,
      `기타 안건 - 하반기 기타필요경비 정산보고는 2월 말 완료 후 ${y + 1}년 3월 1분기 운영위원회에서 보고. 운영위원이 연령별 교사배정을 궁금해함 → 반 구성 확정 후 안내하겠다고 답변`,
    ],
  }[qn].join('\n');
}

// 회의순서 기본값 (원장님 서식: 개회사 → 안건들 → 기타 안건 → 폐회사)
export function defaultOrder(m) {
  const items = ['개회사', ...agendaList(m), '기타 안건', '폐회사'];
  return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
}

// ── 운영위원회 구성 계획 + 회칙 (원장님이 주신 서식을 해마다 자동으로 맞춰 만든다) ──
// 회계연도 기준: {year}년도 = {year}.3.1. ~ {year+1}.2.28.
const roleCount = (members, role) => members.filter((x) => x.role === role).length;

export function rulesPlanBlocks(year, center, members, opts = {}) {
  const y = Number(year);
  const n = {
    원장: roleCount(members, '원장'),
    교사: roleCount(members, '보육교사 대표'),
    부모: roleCount(members, '학부모 대표'),
    지역: roleCount(members, '지역사회 인사'),
  };
  const total = n.원장 + n.교사 + n.부모 + n.지역;
  return [
    ...(opts.noTitle ? [] : [{ type: 'subheading', text: `${y}년도 ${center} 운영위원회 구성 계획` }]),
    { type: 'para', text: '□ 의의' },
    {
      type: 'para',
      text: '어린이집 운영위원회는 어린이집 운영에 교직원, 부모, 지역인사가 참여함으로써 어린이집 운영의 자율성 및 투명성을 확보하고, '
        + '지역실정과 어린이집 특성에 맞는 다양한 보육을 창의적으로 실시할 수 있도록 심의·자문하는 기구이다. '
        + '어린이집은 부모 및 지역사회와 긴밀하게 협력하여 동반자적인 관계를 유지할 때 보육에서 최선의 효과를 얻을 수 있다. '
        + '즉, 어린이집 운영위원회를 통하여 어린이집과 부모, 지역사회가 서로의 의견이나 요구를 나눌 수 있는 공식적 통로를 마련할 수 있고, '
        + '협력하여 영유아들을 위한 질적인 보육서비스를 제공할 수 있다.',
    },
    { type: 'para', text: '□ 법적근거 : 영유아보육법 제25조' },
    { type: 'para', text: `□ 운영위원회 임기 : ${y}년 3월 1일부터 ${y + 1}년 2월 28일까지` },
    { type: 'para', text: '□ 위원 정수' },
    {
      type: 'table',
      head: ['원장', '보육교사 위원', '부모 위원', '지역사회(직장) 위원', '계'],
      widths: ['16%', '21%', '18%', '27%', '18%'],
      rows: [[`${n.원장}명`, `${n.교사}명`, `${n.부모}명`, `${n.지역}명`, `${total}명`]],
    },
    { type: 'para', text: `□ 위원의 선출 : 부모 위원은 ${y}년 3월 초 직접 선출 또는 위촉 방법으로 선출하고, 보육교사 위원은 교사회의에서, 지역위원은 기 선출된 운영위원의 추천을 받아 선출한다.` },
    { type: 'para', text: '□ 연간 운영위원회 회의 일정 (어린이집 회계연도 기준 분기별 1회)' },
    {
      type: 'table',
      head: ['구분', '시기', '주요 내용'],
      widths: ['16%', '26%', '58%'],
      rows: [
        ['1분기', `${y}년 3월`, '회칙 및 규정 점검, 운영위원 위촉, 보육과정 운영 계획 심의, 결정사안 가정통신문 배포'],
        ['2분기', `${y}년 6~8월`, '상반기 운영 점검, 여름철 건강·안전 관리, 결정사안 가정통신문 배포'],
        ['3분기', `${y}년 9~11월`, '보육환경 개선, 부모 의견 수렴 결과 심의, 결정사안 가정통신문 배포'],
        ['4분기', `${y}년 12월 ~ ${y + 1}년 2월`, '연간 운영 평가, 예산·결산 보고, 다음 연도 운영 계획 심의, 결정사안 가정통신문 배포'],
      ],
    },
  ];
}

// 회칙 전문 (원장님이 주신 서식 그대로. 회의 조문만 분기별 1회로 맞춤)
export function defaultRulesText(year, center) {
  const y = Number(year);
  const c = center || '○○어린이집';
  return `${c} 운영위원회 회칙
제정 ${y}. 03. 01.

제1장 총칙

제1조(목적) 이 규정은 영유아보육법 제25조에 준하여 어린이집 운영의 자율성과 투명성을 높이고 지역사회와의 연계를 강화하여 지역실정과 특성에 맞는 보육을 실시할 수 있도록 하기 위하여 ${c} 운영위원회(이하 “운영위원회”라 한다)의 구성 및 운영 등에 관한 사항을 규정함을 목적으로 한다.

제2조(기능) 운영위원회는 다음 각 호의 사항에 대하여 심의한다.
  1. 어린이집 운영 규정의 제정이나 개정에 관한 사항
  2. 어린이집 예산 및 결산의 보고에 관한 사항
  3. 영유아의 건강·영양 및 안전에 관한 사항
  4. 보육 시간, 보육과정의 운영 방법 등 어린이집의 운영에 관한 사항
  5. 보육교직원의 근무환경 개선에 관한 사항
  6. 영유아의 보육환경 개선에 관한 사항
  7. 어린이집과 지역사회의 협력에 관한 사항
  8. 보육교사의 권익 보호에 관한 사항
  9. 보육료 외의 필요경비를 받는 경우, 영유아보육법 제38조에 따른 범위에서 그 수납액 결정에 관한 사항
  10. 그 밖에 부모모니터링단의 모니터링 결과 등 어린이집 운영에 대한 제안 및 건의사항

제2장 위원의 신분

제3조(임기) ① 위원의 임기는 1년으로 하고 연임할 수 있다. 다만, 보궐위원의 임기는 전임자의 잔임 기간으로 한다.
  ② 위원의 임기개시일은 3월 1일로 한다.

제4조(위원의 자격) ① 위원은 무보수 봉사직으로 한다.
  ② 위원은 특별한 사정이 있는 경우를 제외하고는 다른 어린이집의 운영위원을 겸할 수 없다.
  ③ 위원은 어린이집을 상대로 하여 영업하는 자가 아니어야 한다.

제5조(위원의 의무 등) ① 부모 위원을 포함한 위원 전원은 운영위원회 위원으로서의 품위를 유지하여야 한다.
  ② 위원은 운영위원회 회의에 성실히 참여하여야 한다.
  ③ 위원은 그 지위를 남용하여 재산상의 권리·이익의 취득 또는 알선을 하여서는 아니 된다.
  ④ 위원은 정치적, 종교적 중립을 지켜야 한다.

제6조(위원의 자격상실) 위원이 다음 각 호의 1에 해당할 때에는 자격을 상실한다. 단, 제3호·제5호 사항은 운영위원회의 결정에 따라 처리한다.
  1. 보육교사위원이 퇴직 등에 의하여 소속을 달리한 때
  2. 부모위원은 자녀인 영유아가 졸업·퇴원하게 된 때
  3. 위원이 제4조와 제5조의 규정을 위반한 사실이 발견된 때
  4. 회의소집 통지를 받고도 특별한 사유 없이 3회 연속 회의에 불참하였을 때
  5. 위원이 제출한 신상에 관한 주요내용에 허위사실이 있는 것이 발견된 때

제3장 위원의 선출

제7조(위원의 정수) 운영위원회 정수는 위원장, 부위원장 각 1인을 포함하여 총 5인 이상 10인 이내로 아동 수 등 어린이집 규모와 운영상의 효율성을 고려하여 구성하되, 어린이집 종사자 위원 수가 부모 위원 등 외부 위원 수를 초과하여서는 아니 된다.

제8조(위원의 선출) ① 원장은 운영위원회의 당연직 위원이 된다.
  ② 부모위원은 부모 중에서 민주적인 선거절차에 따라 직접 선출한다. 다만, 어린이집의 규모 등을 고려하여 전체 부모회의에서 선출하기 곤란한 경우 연령별 또는 반별 부모회의에서 선출한다.
  ③ 보육교사위원은 교사회의에서 선출한다.
  ④ 지역위원은 이미 선출된 운영위원의 추천을 받아 선출한다.

제9조(선출일) 부모위원 및 보육교사위원은 임기만료일 10일 이전에, 지역위원은 임기만료일 전일까지 선출한다.

제10조(보궐선거) 위원이 궐원된 때에는 보궐 선출한다. 다만, 잔여임기가 6월 미만으로서 위원정수의 4분의 1 이상이 궐원되지 아니한 때에는 운영위원회의 결정으로 선출하지 아니할 수 있다.

제4장 운영위원회 조직

제11조(임원) ① 운영위원회에는 위원장 및 부위원장 각 1인을 두되, 위원장은 어린이집 보육교직원이 아닌 위원 중에서 호선한다.
  ② 위원장과 부위원장의 임기는 2년으로 하며, 연임할 수 있다.
  ③ 위원장과 부위원장은 운영위원회의 동의를 얻어 그 직을 사임할 수 있다.
  ④ 위원장은 운영위원회를 대표하고 회의를 소집하여 진행하며, 부위원장은 위원장이 사고가 있을 때에 그 직무를 대행한다.
  ⑤ 위원장 또는 부위원장이 임기 중에 궐위된 때에는 보궐 선출할 수 있으며, 그 임기는 전임자의 잔임 기간으로 한다.

제12조(소위원회) ① 운영위원회는 안건심사의 효율성을 기하기 위하여 소위원회를 운영할 수 있다.
  ② 소위원회의 권한은 소위원회를 구성할 당시 결정하며, 소위원회를 운영할 경우 세부규정은 운영위원회에서 따로 정한다.

제13조(간사) ① 운영위원회의 회의기록 등 사무를 처리하기 위하여 간사를 둔다.
  ② 간사는 위원 중에서 호선한다.

제5장 운영위원회의 운영

제14조(회기 등) ① 회의는 정기회와 임시회로 구분하며, 정기회는 어린이집 회계연도를 기준으로 분기마다 1회씩 연 4회 개최한다. 이 경우 1분기는 3월, 2분기는 6월부터 8월까지, 3분기는 9월부터 11월까지, 4분기는 12월부터 다음 해 2월까지로 한다.
  ② 임시회는 위원장 또는 재적위원 과반수의 요구가 있는 때에 위원장이 소집한다.
  ③ 회의는 개최예정일 7일 전에 소집공고와 함께 회의안건을 첨부하여 위원에게 개별통지한다. 다만, 위원장이 긴급을 요하는 안건이라고 인정할 경우는 그러하지 아니한다.

제15조(안건의 제출·발의) 운영위원회에서 처리할 안건은 원장 또는 재적위원 3분의 1 이상의 연서로 제출하거나 발의한다.

제16조(의사 및 의결 정족수) 운영위원회는 재적위원 과반수의 출석으로 개의하며, 출석위원 과반수의 찬성으로 결정한다.

제17조(회의 공개의 원칙) ① 운영위원회의 회의는 공개함을 원칙으로 한다. 다만, 영유아 또는 보육교사의 인권보호 등을 위하여 필요하다고 인정하는 경우에는 운영위원회의 결정으로 공개하지 아니할 수 있다.
  ② 운영위원회가 회의를 개최할 때에는 가정통신문, 어린이집 게시판 등을 통하여 회의 개최일자, 안건 등을 알림으로써 일반 부모, 보육교사 등이 회의를 참관할 수 있도록 한다.

제18조(회의록 작성 등) ① 운영위원회는 회의록을 작성하고 회의의 진행 내용 및 결과와 출석위원의 성명을 기재한 후 위원장과 원장이 서명한다.
  ② 위원장은 회의록을 어린이집에 비치하여 부모, 보육교사 및 지역주민 등이 열람할 수 있도록 한다.
  ③ 운영위원회는 회의 결과를 가정통신문 등을 통하여 전체 부모에게 공개한다.

부칙

제1조(시행일) 이 회칙은 공포한 날로부터 시행한다.
제2조(경과 조치) ① 이 회칙에 의하여 선출된 위원의 임기는 ${y}년 3월 1일부터 개시한 것으로 본다.
  ② 제2조에 규정된 운영위원회의 심의 사항 중 최초의 회의가 개최되기 전에 시행한 사항은 운영위원회의 심의를 거친 것으로 본다.`;
}

function memberTable(members) {
  return {
    type: 'table',
    head: ['번호', '성명', '구분', '비고'],
    widths: ['12%', '28%', '32%', '28%'],
    rows: members.length ? members.map((x, i) => [String(i + 1), x.name, x.role, '']) : [['', '', '', '']],
  };
}

// 한 차수 분량의 블록 (withRules=true면 그 해 회칙도 같이 넣는다)
function meetingBlocks(data, i, opts = {}) {
  const info = MEETINGS[i];
  const m = data.meetings[i];
  const members = membersOf(data, i);
  const present = presentMembers(members, m);
  const agenda = agendaList(m);
  const b = [];

  if (!opts.noHead) {
    b.push({ type: 'sessionhead', text: `${info.no} · ${qLabel(i)} : ${whenText(m) || '일시 미입력'}` });
  }
  b.push({
    type: 'kv',
    rows: [
      ['일시', whenText(m)],
      ['장소', m.place || ''],
      ['참석자', attendText(members, m)],
      ['안건', agenda.length ? agenda.map((t, n) => `${n + 1}. ${t}`).join('\n') : ''],
    ],
  });

  // ① 개최 공지문
  b.push({ type: 'subheading', text: '운영위 공지내용' });
  b.push({ type: 'para', text: m.notice || '' });

  // ② 회의록 (원장님 서식: 표 → 회의순서 → 토의 및 의결사항 → 서명)
  b.push({ type: 'subheading', text: `운영위 회의록 (${qLabel(i)})` });
  b.push({
    type: 'kv',
    rows: [
      ['일 시', whenText(m)],
      ['장 소', m.place || ''],
      ['간 사', m.secretary || ''],
      ['참석현황', attendLines(members, m)],
      ['참석인원', `${present.length + (m.guests?.trim() ? 1 : 0)}명`],
    ],
  });
  if (m.order) {
    b.push({ type: 'para', text: `[회의순서]\n${m.order}` });
  }
  b.push({ type: 'para', text: `[토의 및 의결사항]\n${m.discussion || m.memo || ''}` });
  b.push({ type: 'para', text: closingText(i) });
  b.push({
    type: 'table',
    head: ['구분', '성명', '서명'],
    widths: ['34%', '33%', '33%'],
    rows: signRows(members),
  });

  // ③ 회의결과 보고서(안내문)
  b.push({ type: 'subheading', text: `운영위 결과보고서 (${noticeMonthLabel(m, i)})` });
  b.push({ type: 'para', text: m.result || '' });

  // ④ 그 분기 내용 정리
  if (m.feature) {
    b.push({ type: 'subheading', text: `${info.qn}분기 운영위 내용정리` });
    b.push({ type: 'para', text: m.feature });
  }

  const photos = (m.photos || []).filter(Boolean);
  if (photos.length) {
    b.push({ type: 'photos', items: photos, caption: `${info.no} 운영위원회 회의 사진` });
  }
  return b;
}

// 그 해의 구성계획 (위원 명단 + 의의·법적근거·임기·정수·연간일정)
function planSection(data, year, center) {
  const list = (data?.members?.[year] || []).filter((x) => x.name?.trim());
  return [
    { type: 'subheading', text: `${year}년 운영위원 명단` },
    memberTable(list),
    ...rulesPlanBlocks(year, center, list, { noTitle: true }),
  ];
}

// 한 차수만 미리 보기 — 원장님이 정한 구성 순서
//   1. 구성계획  2. 회칙  3. 그 분기 운영위 내용
export function buildOneMeetingDoc(data, i, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const info = MEETINGS[i];
  const y = info.year;
  return [
    { type: 'title', text: `${center} 운영위회의 자료` },
    { type: 'lead', text: `${info.no} · ${qLabel(i)} (${whenText(data.meetings[i]) || '일시 미입력'})` },

    { type: 'heading', text: `1. ${y}년도 ${center} 운영위원회 구성계획` },
    ...planSection(data, y, center),

    { type: 'heading', text: `2. ${y}년 운영위원회 회칙` },
    { type: 'para', text: data?.rules?.[y]?.text?.trim() || defaultRulesText(y, center) },

    { type: 'heading', text: `3. ${info.qn}분기 운영위 내용` },
    ...meetingBlocks(data, i, { noHead: true }),
  ];
}

// 네 차수를 한 문서로
export function buildCommitteeDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const blocks = [{ type: 'title', text: `${center} 운영위회의 자료` }];

  blocks.push({ type: 'heading', text: `1. ${center} 운영위원회 구성계획` });
  YEARS.forEach((y, n) => {
    if (n) blocks.push({ type: 'divider' });
    blocks.push({ type: 'subheading', text: `${y}년도 구성계획` });
    planSection(data, y, center).forEach((x) => blocks.push(x));
  });

  blocks.push({ type: 'heading', text: '2. 운영위원회 회칙' });
  YEARS.forEach((y, n) => {
    if (n) blocks.push({ type: 'divider' });
    blocks.push({ type: 'subheading', text: `${y}년 운영위원회 회칙` });
    blocks.push({ type: 'para', text: data?.rules?.[y]?.text?.trim() || defaultRulesText(y, center) });
  });

  blocks.push({ type: 'heading', text: '3. 회의 개최 현황' });
  blocks.push({
    type: 'table',
    head: ['차수', '해당 분기', '개최 시기 기준', '개최 일시', '참석 인원'],
    widths: ['10%', '20%', '24%', '30%', '16%'],
    rows: MEETINGS.map((info, i) => {
      const m = data.meetings[i];
      const n = meetingHasContent(m) ? presentMembers(membersOf(data, i), m).length : 0;
      return [info.no, info.quarter, info.when, meetingHasContent(m) ? whenText(m) : '미개최', n ? `${n}명` : ''];
    }),
  });

  blocks.push({ type: 'heading', text: '4. 분기별 운영위 내용' });
  let first = true;
  MEETINGS.forEach((info, i) => {
    if (!meetingHasContent(data.meetings[i])) return;
    if (!first) blocks.push({ type: 'divider' });
    first = false;
    meetingBlocks(data, i).forEach((x) => blocks.push(x));
  });
  if (first) {
    blocks.push({ type: 'note', text: '※ 아직 입력한 차수가 없습니다. 1차부터 차례로 작성해 주세요.' });
  }

  return blocks;
}

// 화면 블록 → 한글(hwpx) 문단 (사진은 글로 바꿔 넣는다)
export function toHwpxBlocks(blocks) {
  const out = [];
  blocks.forEach((b) => {
    if (b.type === 'title') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'heading' || b.type === 'sessionhead' || b.type === 'subheading') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'kv') b.rows.forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${String(v || '').replace(/\n/g, ' / ')}` }));
    else if (b.type === 'table') {
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.join(' | ') }));
    }
    else if (b.type === 'photos') out.push({ kind: 'note', text: `※ 회의 사진 ${b.items.filter(Boolean).length}장은 PDF 파일에 들어 있습니다. 한글 문서에는 사진을 직접 붙여 넣어 주세요.` });
  });
  return out;
}
