// 열린어린이집 평가항목별 문서 정의 (2026 교육부 선정·운영 기준 기반)
// 각 문서: 입력필드(fields) + AI 초안 규격(ai) + 출력 블록 생성(build)
// 블록 타입: title, meta, heading, para, kv(라벨/값 표), table(머리글+행), note, sign

export const AREAS = [
  { id: 'open', label: '개방성', color: '#2E7D68', selfCheck: true },
  { id: 'join', label: '참여성', color: '#1F6FB2' },
  { id: 'diverse', label: '다양성', color: '#C77A2B' },
];

// 열린어린이집 심사기준 요약 (교육부 2026 선정·운영 기준 기반, 총 100점 / 80점 이상 선정)
export const CRITERIA = [
  {
    id: 'open', area: '1. 개방성', points: 35, min: 25, color: '#2E7D68',
    items: [
      { name: '공간 개방성', pt: 20, freq: '상시 (현장확인)', note: '참관실 또는 보육실 창문·문 투명창으로 언제든 관찰 가능' },
      { name: '부모 공용공간', pt: 5, freq: '상시 (현장확인)', note: '부모대기실·상담실 등 + 게시판·건의함·육아책자' },
      { name: '온라인 소통창구', pt: 10, freq: '월 1회 이상', note: '홈페이지·블로그·밴드 등 양방향 소통, 전체 부모 공개' },
    ],
  },
  {
    id: 'join', area: '2. 참여성', points: 35, min: 25, color: '#1F6FB2',
    items: [
      { name: '부모 개별상담', pt: 5, freq: '연 2회 (상·하반기 각 1회)', note: '영유아 90% 이상 부모와 상담, 기록 보관' },
      { name: '운영위원회 / 총회', pt: 10, freq: '분기별 1회 (연 4회)', note: '운영규정·개최공지·회의록·결과공지 모두 갖춰야 함' },
      { name: '부모참여프로그램 (열린어린이집의 날)', pt: 5, freq: '반기별 1회 (연 2회)', note: '연간계획+실시횟수+실시기록' },
      { name: '부모만족도 조사', pt: 10, freq: '연 1회', note: '결과 기록 + 전체 부모에게 결과 안내' },
      { name: '부모 어린이집 참관', pt: 5, freq: '연중 상시', note: '참관안내문 게시 + 상시운영' },
    ],
  },
  {
    id: 'diverse', area: '3. 다양성', points: 15, min: 5, color: '#C77A2B',
    items: [
      { name: '어린이집 간 연계·협력', pt: 10, freq: '연 2회 이상', note: '타 어린이집과 공동 프로그램·행사·자원 공유 등' },
      { name: '부모참여활동 지역사회 연계', pt: 5, freq: '연 2회 이상', note: '부모가 함께 참여하는 지역사회 연계활동 (영유아만 대상은 미인정)' },
    ],
  },
  {
    id: 'local', area: '4. 지자체 자체기준', points: 15, min: 5, color: '#6B7280',
    items: [
      { name: '지자체가 정한 자체 선정기준', pt: 15, freq: '지자체별 상이', note: '예) 부모 자율모임 구성·운영 등 (지역별 확인 필요)' },
    ],
  },
];

// 공통 머리(어린이집 이름/작성일)
const commonHead = [
  { key: 'centerName', label: '어린이집 이름', type: 'text', placeholder: '예) 햇살어린이집', required: true },
];

export const DOCS = [
  // ───────────────────────── 개방성 ─────────────────────────
  {
    id: 'online-post',
    area: 'open',
    name: '온라인 소통 게시글',
    freq: '월 1회 이상',
    item: '1-다. 온라인 소통창구 (10점)',
    desc: '홈페이지·블로그·밴드 등에 올릴 소통 게시글을 만들고, 게시 기록으로 저장합니다.',
    fields: [
      ...commonHead,
      { key: 'date', label: '게시일', type: 'date' },
      { key: 'channel', label: '게시 채널', type: 'select', options: ['홈페이지', '블로그', '네이버 카페', '밴드', '카카오톡 채널', '기타'] },
      { key: 'topic', label: '이번 달 소식 주제', type: 'text', placeholder: '예) 6월 텃밭 활동과 여름철 건강수칙 안내' },
      { key: 'points', label: '전하고 싶은 내용 메모', type: 'textarea', placeholder: '떠오르는 대로 편하게 적어주세요. 예) 텃밭에서 상추 수확, 물놀이 안전교육, 여름 준비물 안내' },
    ],
    ai: {
      button: '게시글 자동 작성',
      keys: ['postTitle', 'postBody'],
      system: '당신은 어린이집이 부모 전체에게 올리는 온라인 소식글을 쓰는 전문가입니다. 따뜻하고 정중한 존댓말로, 부모가 편하게 읽을 수 있게 씁니다. 큰따옴표(")는 절대 쓰지 않습니다. 게시글 본문(postBody)은 4~6문장으로 넉넉히 쓰고, 마지막에 궁금한 점은 언제든 댓글이나 문의 바랍니다 같은 양방향 소통을 유도하는 문장을 넣습니다. 아래 JSON 하나만 출력합니다. {"postTitle":"게시글 제목","postBody":"게시글 본문"}',
      user: (v) => `어린이집: ${v.centerName || ''}\n게시 채널: ${v.channel || ''}\n주제: ${v.topic || ''}\n전하고 싶은 내용: ${v.points || ''}`,
    },
    build: (v, ai) => [
      { type: 'title', text: '온라인 소통 게시글' },
      { type: 'kv', rows: [['어린이집', v.centerName], ['게시일', v.date], ['게시 채널', v.channel]] },
      { type: 'heading', text: '게시 제목' },
      { type: 'para', text: ai?.postTitle || v.topic || '' },
      { type: 'heading', text: '게시 내용' },
      { type: 'para', text: ai?.postBody || v.points || '' },
      { type: 'note', text: '※ 위 게시글은 전체 부모에게 공개되었으며, 게시판·댓글 등을 통해 어린이집과 부모 간 양방향 소통이 이루어졌습니다. (월 1회 이상 정기 업데이트 증빙)' },
    ],
  },

  // ───────────────────────── 참여성 ─────────────────────────
  {
    id: 'counsel',
    area: 'join',
    name: '부모 개별상담 기록',
    freq: '연 2회 이상 (상·하반기 각 1회)',
    item: '2-가. 부모 개별상담 (5점)',
    desc: '부모 개별상담 내용을 정리한 상담 기록지를 만듭니다.',
    fields: [
      ...commonHead,
      { key: 'date', label: '상담일', type: 'date' },
      { key: 'className', label: '반 이름', type: 'text', placeholder: '예) 햇님반' },
      { key: 'childName', label: '원아 이름', type: 'text' },
      { key: 'parentName', label: '보호자 이름', type: 'text' },
      { key: 'method', label: '상담 방법', type: 'select', options: ['대면상담', '전화상담', '화상상담'] },
      { key: 'teacher', label: '담임교사', type: 'text' },
      { key: 'memo', label: '상담 내용 메모', type: 'textarea', placeholder: '아이의 발달·생활 모습, 부모님 이야기, 요청사항 등을 편하게 적어주세요.' },
    ],
    ai: {
      button: '상담내용 정리',
      keys: ['content', 'agreement'],
      system: '당신은 어린이집 담임교사가 작성하는 부모 개별상담 기록을 정리하는 전문가입니다. 교사의 메모를 바탕으로, 아이의 발달·생활 모습과 부모님의 이야기를 차분하고 전문적인 문어체로 정리합니다. 없는 사실은 지어내지 않습니다. 큰따옴표(")는 쓰지 않습니다. content(상담 내용)는 4~6문장, agreement(협의 및 지원 사항)는 2~3문장으로 씁니다. 아래 JSON 하나만 출력합니다. {"content":"상담 내용 정리","agreement":"가정과 협의한 지원 사항"}',
      user: (v) => `원아: ${v.childName || ''} (${v.className || ''})\n상담 방법: ${v.method || ''}\n교사 메모: ${v.memo || ''}`,
    },
    build: (v, ai) => [
      { type: 'title', text: '부모 개별상담 기록지' },
      { type: 'kv', rows: [['어린이집', v.centerName], ['반 / 원아', `${v.className || ''} / ${v.childName || ''}`], ['보호자', v.parentName], ['상담일 / 방법', `${v.date || ''} / ${v.method || ''}`], ['담임교사', v.teacher]] },
      { type: 'heading', text: '상담 내용' },
      { type: 'para', text: ai?.content || v.memo || '' },
      { type: 'heading', text: '협의 및 지원 사항' },
      { type: 'para', text: ai?.agreement || '' },
      { type: 'sign', text: v.centerName, role: '담임교사', name: v.teacher },
    ],
  },
  {
    id: 'committee-minutes',
    area: 'join',
    name: '운영위원회 회의록',
    freq: '분기별 1회 이상 (연 4회)',
    item: '2-나. 어린이집 운영위원회 (10점)',
    desc: '운영위원회 회의록을 만듭니다. (개최 안내·결과 안내는 아래 "운영위원회 안내문"으로 함께 준비하세요.)',
    fields: [
      ...commonHead,
      { key: 'quarter', label: '회차', type: 'select', options: ['1분기', '2분기', '3분기', '4분기'] },
      { key: 'date', label: '회의 일시', type: 'text', placeholder: '예) 2026. 3. 20.(목) 오후 5시' },
      { key: 'place', label: '장소', type: 'text', placeholder: '예) 어린이집 회의실' },
      { key: 'attendees', label: '참석자', type: 'textarea', placeholder: '이름과 구분을 쉼표로. 예) 김원장(원장), 이교사(보육교사), 박○○(학부모), 최○○(지역사회 인사)' },
      { key: 'agenda', label: '안건', type: 'textarea', placeholder: '안건을 줄 또는 쉼표로. 예) 2026년 급식 운영 계획, 여름철 안전관리, 부모참여수업 일정' },
      { key: 'notes', label: '논의·결정 메모', type: 'textarea', placeholder: '안건별로 오간 이야기와 결정된 내용을 편하게 적어주세요.' },
    ],
    ai: {
      button: '회의록 자동 정리',
      keys: ['discussion', 'decisions'],
      system: '당신은 어린이집 운영위원회 회의록을 정리하는 전문가입니다. 참석자 메모를 바탕으로 안건별 논의 내용과 결정 사항을 공식 회의록 문어체로 정리합니다. 없는 내용은 지어내지 않되, 메모를 매끄러운 문장으로 다듬습니다. 큰따옴표(")는 쓰지 않습니다. discussion은 안건별로 문단을 나눠 정리하고, decisions는 결정된 사항을 번호(1. 2. 3.)로 정리합니다. 아래 JSON 하나만 출력합니다. {"discussion":"안건별 논의 내용","decisions":"결정 사항"}',
      user: (v) => `회차: ${v.quarter || ''}\n안건: ${v.agenda || ''}\n논의·결정 메모: ${v.notes || ''}`,
    },
    build: (v, ai) => [
      { type: 'title', text: `${v.centerName || '○○어린이집'} 운영위원회 회의록` },
      { type: 'kv', rows: [['회차', v.quarter], ['일시', v.date], ['장소', v.place], ['참석자', v.attendees]] },
      { type: 'heading', text: '안건' },
      { type: 'para', text: v.agenda || '' },
      { type: 'heading', text: '논의 내용' },
      { type: 'para', text: ai?.discussion || v.notes || '' },
      { type: 'heading', text: '결정 사항' },
      { type: 'para', text: ai?.decisions || '' },
      { type: 'note', text: '※ 본 회의록은 운영위원회 개최 후 회의결과 안내공지와 함께 전체 부모에게 공개되었습니다.' },
      { type: 'sign', text: v.centerName, role: '작성자', name: '' },
    ],
  },
  {
    id: 'committee-notice',
    area: 'join',
    name: '운영위원회 안내문 (개최/결과)',
    freq: '회의마다 (개최 전·후)',
    item: '2-나. 어린이집 운영위원회 (10점)',
    desc: '운영위원회 개최 안내문 또는 회의결과 안내문을 만듭니다. 두 가지 모두 갖춰야 배점을 받습니다.',
    fields: [
      ...commonHead,
      { key: 'kind', label: '안내문 종류', type: 'select', options: ['개최 안내문', '회의결과 안내문'] },
      { key: 'quarter', label: '회차', type: 'select', options: ['1분기', '2분기', '3분기', '4분기'] },
      { key: 'when', label: '회의 일시', type: 'text', placeholder: '예) 2026. 3. 20.(목) 오후 5시' },
      { key: 'content', label: '안건 또는 결과 메모', type: 'textarea', placeholder: '개최 안내면 안건을, 결과 안내면 결정된 내용을 적어주세요.' },
      { key: 'principal', label: '원장 이름', type: 'text' },
    ],
    ai: {
      button: '안내문 자동 작성',
      keys: ['body'],
      system: '당신은 어린이집이 부모에게 보내는 운영위원회 안내문을 쓰는 전문가입니다. 정중한 존댓말로, 종류(개최 안내/결과 안내)에 맞게 씁니다. 개최 안내면 회의 일시·안건을 알리고 부모위원의 관심과 참여를 정중히 요청합니다. 결과 안내면 회의에서 논의·결정된 내용을 간결히 전합니다. 큰따옴표(")는 쓰지 않습니다. body는 4~6문장으로 씁니다. 아래 JSON 하나만 출력합니다. {"body":"안내문 본문"}',
      user: (v) => `종류: ${v.kind || ''}\n회차: ${v.quarter || ''}\n회의 일시: ${v.when || ''}\n안건/결과: ${v.content || ''}`,
    },
    build: (v, ai) => [
      { type: 'title', text: `운영위원회 ${(v.kind || '개최 안내문')}` },
      { type: 'para', text: '안녕하십니까? 항상 저희 어린이집에 관심과 사랑을 보내주셔서 감사합니다.' },
      { type: 'para', text: ai?.body || v.content || '' },
      { type: 'sign', text: `${v.date || '2026년    월    일'}`, role: `${v.centerName || ''} 원장`, name: v.principal },
    ],
  },
  {
    id: 'open-day',
    area: 'join',
    name: '부모참여프로그램(열린어린이집의 날) 실시기록',
    freq: '반기별 1회 이상 (연 2회)',
    item: '2-다. 부모참여프로그램 (5점)',
    desc: '열린어린이집의 날(부모참여수업·재능기부 등) 실시 기록을 만듭니다.',
    fields: [
      ...commonHead,
      { key: 'half', label: '구분', type: 'select', options: ['상반기', '하반기'] },
      { key: 'date', label: '실시일', type: 'date' },
      { key: 'program', label: '프로그램명', type: 'text', placeholder: '예) 아빠와 함께하는 그림책 놀이' },
      { key: 'target', label: '대상', type: 'text', placeholder: '예) 만 3세반 부모 및 원아' },
      { key: 'participants', label: '참여 인원', type: 'text', placeholder: '예) 부모 12명, 원아 12명' },
      { key: 'content', label: '활동 내용 메모', type: 'textarea', placeholder: '무엇을 어떻게 진행했는지, 부모 반응 등을 편하게 적어주세요.' },
    ],
    ai: {
      button: '실시기록 자동 작성',
      keys: ['overview', 'progress', 'feedback'],
      system: '당신은 어린이집 부모참여프로그램(열린어린이집의 날) 실시기록을 작성하는 전문가입니다. 교사 메모를 바탕으로 활동 개요, 진행 내용, 참여 소감 및 평가를 공식 기록 문어체로 정리합니다. 없는 사실은 지어내지 않습니다. 큰따옴표(")는 쓰지 않습니다. overview 2~3문장, progress 4~6문장, feedback 2~3문장. 아래 JSON 하나만 출력합니다. {"overview":"활동 개요","progress":"진행 내용","feedback":"참여 소감 및 평가"}',
      user: (v) => `프로그램명: ${v.program || ''}\n대상: ${v.target || ''}\n참여 인원: ${v.participants || ''}\n활동 내용: ${v.content || ''}`,
    },
    build: (v, ai) => [
      { type: 'title', text: '부모참여프로그램(열린어린이집의 날) 실시기록' },
      { type: 'kv', rows: [['어린이집', v.centerName], ['구분 / 실시일', `${v.half || ''} / ${v.date || ''}`], ['프로그램명', v.program], ['대상', v.target], ['참여 인원', v.participants]] },
      { type: 'heading', text: '활동 개요' },
      { type: 'para', text: ai?.overview || '' },
      { type: 'heading', text: '진행 내용' },
      { type: 'para', text: ai?.progress || v.content || '' },
      { type: 'heading', text: '참여 소감 및 평가' },
      { type: 'para', text: ai?.feedback || '' },
      { type: 'sign', text: v.centerName, role: '작성자', name: '' },
    ],
  },
  {
    id: 'satisfaction',
    area: 'join',
    name: '부모만족도조사 결과 보고서',
    freq: '연 1회',
    item: '2-라. 부모만족도 조사 (10점)',
    desc: '부모만족도조사 결과를 정리한 보고서를 만듭니다. (조사 설문지 서식은 아래 "만족도조사 설문지"에서 받으세요.)',
    fields: [
      ...commonHead,
      { key: 'period', label: '조사 기간', type: 'text', placeholder: '예) 2026. 11. 3. ~ 11. 14.' },
      { key: 'respondents', label: '응답 부모 수', type: 'text', placeholder: '예) 전체 40명 중 36명 응답' },
      { key: 'highlights', label: '주요 결과 메모', type: 'textarea', placeholder: '만족도가 높았던 부분, 낮았던 부분, 부모 건의사항 등을 적어주세요.' },
    ],
    ai: {
      button: '결과 보고서 자동 작성',
      keys: ['summary', 'strengths', 'improve'],
      system: '당신은 어린이집 부모만족도조사 결과 보고서를 작성하는 전문가입니다. 메모를 바탕으로 종합 결과, 만족도가 높은 부분, 개선 계획을 공식 보고서 문어체로 정리합니다. 없는 수치는 지어내지 않습니다. 큰따옴표(")는 쓰지 않습니다. summary 3~4문장, strengths 2~3문장, improve 2~3문장(구체적 개선 계획). 아래 JSON 하나만 출력합니다. {"summary":"종합 결과","strengths":"만족도가 높은 부분","improve":"개선 계획"}',
      user: (v) => `조사 기간: ${v.period || ''}\n응답 인원: ${v.respondents || ''}\n주요 결과 메모: ${v.highlights || ''}`,
    },
    build: (v, ai) => [
      { type: 'title', text: '부모만족도조사 결과 보고서' },
      { type: 'kv', rows: [['어린이집', v.centerName], ['조사 기간', v.period], ['응답 인원', v.respondents]] },
      { type: 'heading', text: '종합 결과' },
      { type: 'para', text: ai?.summary || v.highlights || '' },
      { type: 'heading', text: '만족도가 높은 부분' },
      { type: 'para', text: ai?.strengths || '' },
      { type: 'heading', text: '개선 계획' },
      { type: 'para', text: ai?.improve || '' },
      { type: 'note', text: '※ 본 결과는 전체 부모에게 안내되었습니다.' },
      { type: 'sign', text: v.centerName, role: '원장', name: '' },
    ],
  },
  {
    id: 'visit-notice',
    area: 'join',
    name: '어린이집 개방(참관) 안내문',
    freq: '연중 상시 게시',
    item: '2-마. 부모 어린이집 참관 (5점)',
    desc: '어린이집에 상시 게시하는 개방(참관) 안내문입니다. (별지 제6호 서식 기반, AI 없이 바로 완성)',
    fields: [
      ...commonHead,
      { key: 'date', label: '작성일', type: 'text', placeholder: '예) 2026년 3월 4일' },
      { key: 'principal', label: '원장 이름', type: 'text' },
    ],
    ai: null,
    build: (v) => [
      { type: 'title', text: `${v.centerName || '○○어린이집'} 개방 안내문` },
      { type: 'para', text: `안녕하십니까? 항상 ${v.centerName || '○○어린이집'}에 대한 관심과 사랑을 보내주심에 감사드립니다.` },
      { type: 'para', text: `${v.centerName || '○○어린이집'}에서는 부모님께서 보육일과를 지켜보거나, 보육활동 일부를 참여하실 수 있도록 어린이집을 상시 개방 운영하고 있습니다. 이는 자녀의 어린이집 생활을 이해하는 데 많은 도움이 될 것입니다. 개방(참관)은 보육활동에 지장을 초래하지 않는 범위 내에서 진행하고 있으며, 아래와 같이 개방(참관) 절차에 대해 안내드립니다.` },
      { type: 'heading', text: '참관 절차' },
      { type: 'para', text: '① 참관 신청서 작성 및 제출  →  ② 참관 일정 협의  →  ③ 참관 유의사항 확인  →  ④ 어린이집 참관 실시' },
      { type: 'heading', text: '참관 시 유의 사항' },
      { type: 'para', text: '1. 보육실 개방 시간은 반별 하루 일과를 참고하시어 담임선생님과 협의하여 주시기 바랍니다.\n2. 다른 영유아들의 활동에 방해가 되지 않는 범위 내에서 참관을 허용합니다.\n3. 참관 시 안정된 보육활동이 지속될 수 있도록 협조 바랍니다.\n4. 영유아들의 건강과 위생을 위해 손 소독 후 입실하여 주시기 바랍니다.\n5. 감기, 코로나 등 전염성 질환이 있는 경우 입실을 제한하고 있으니 양해 바랍니다.\n6. 참관 신청양식은 사무실에 비치하고 있습니다.' },
      { type: 'sign', text: v.date || '2026년    월    일', role: `${v.centerName || '○○어린이집'} 원장`, name: v.principal },
    ],
  },
  {
    id: 'visit-form',
    area: 'join',
    name: '참관 신청서 (빈 양식)',
    freq: '수시 (비치용)',
    item: '2-마. 부모 어린이집 참관 (5점)',
    desc: '부모가 작성하는 참관 신청서 빈 양식입니다. (별지 제7호 서식, 인쇄해서 비치하세요)',
    fields: [...commonHead],
    ai: null,
    build: (v) => [
      { type: 'title', text: `${v.centerName || '○○어린이집'} 참관신청서` },
      { type: 'kv', rows: [['원아 성명', ''], ['반명', ''], ['신청인 성명', ''], ['원아와의 관계', ''], ['주소', ''], ['전화번호', ''], ['참관 희망일 / 시간', ''], ['참관 신청 사유', '']] },
      { type: 'para', text: `위와 같이 ${v.centerName || '○○어린이집'} 참관을 신청합니다.` },
      { type: 'sign', text: '2026년    월    일', role: '신청인(보호자)', name: '(서명 또는 인)' },
    ],
  },

  // ───────────────────────── 다양성 ─────────────────────────
  {
    id: 'network',
    area: 'diverse',
    name: '연계·협력 활동 실시기록',
    freq: '연 2회 이상',
    item: '3-가/3-나. 어린이집 간 / 지역사회 연계 (각 10·5점)',
    desc: '다른 어린이집과의 연계, 또는 지역사회와 연계한 부모참여 활동의 실시 기록을 만듭니다.',
    fields: [
      ...commonHead,
      { key: 'type', label: '연계 유형', type: 'select', options: ['어린이집 간 연계·협력', '지역사회 연계 부모참여 활동'] },
      { key: 'date', label: '실시일', type: 'date' },
      { key: 'partner', label: '연계 대상', type: 'text', placeholder: '예) ○○어린이집 / 구립도서관 / 소방서' },
      { key: 'activity', label: '활동명', type: 'text', placeholder: '예) 공동 텃밭 가꾸기 / 도서관 나들이' },
      { key: 'participants', label: '대상', type: 'text', placeholder: '예) 만 4세반 부모 및 원아' },
      { key: 'content', label: '활동 내용 메모', type: 'textarea', placeholder: '어떻게 연계·진행했는지 편하게 적어주세요.' },
    ],
    ai: {
      button: '실시기록 자동 작성',
      keys: ['overview', 'progress', 'outcome'],
      system: '당신은 어린이집 연계·협력 활동 실시기록을 작성하는 전문가입니다. 메모를 바탕으로 활동 개요, 진행 내용, 성과를 공식 기록 문어체로 정리합니다. 지역사회 연계는 부모가 함께 참여한 활동이어야 인정되므로 부모 참여 부분을 자연스럽게 드러냅니다. 없는 사실은 지어내지 않습니다. 큰따옴표(")는 쓰지 않습니다. overview 2~3문장, progress 4~6문장, outcome 2~3문장. 아래 JSON 하나만 출력합니다. {"overview":"활동 개요","progress":"진행 내용","outcome":"성과"}',
      user: (v) => `연계 유형: ${v.type || ''}\n연계 대상: ${v.partner || ''}\n활동명: ${v.activity || ''}\n대상: ${v.participants || ''}\n활동 내용: ${v.content || ''}`,
    },
    build: (v, ai) => [
      { type: 'title', text: '연계·협력 활동 실시기록' },
      { type: 'kv', rows: [['어린이집', v.centerName], ['연계 유형', v.type], ['연계 대상', v.partner], ['활동명 / 실시일', `${v.activity || ''} / ${v.date || ''}`], ['대상', v.participants]] },
      { type: 'heading', text: '활동 개요' },
      { type: 'para', text: ai?.overview || '' },
      { type: 'heading', text: '진행 내용' },
      { type: 'para', text: ai?.progress || v.content || '' },
      { type: 'heading', text: '성과' },
      { type: 'para', text: ai?.outcome || '' },
      { type: 'sign', text: v.centerName, role: '작성자', name: '' },
    ],
  },
];

// 열린어린이집 선정에서 "중요하게 보는" 핵심 서류와 연간 필요 횟수
// emphasize=true 는 자주 만들어야 해 놓치기 쉬운 문서
export const KEY_SCHEDULE = [
  { doc: '온라인 소통 게시글', area: 'open', freq: '월 1회 이상', yearly: '연 12회 이상', emphasize: true },
  { doc: '운영위원회 회의록 + 개최·결과 안내문', area: 'join', freq: '분기별 1회', yearly: '연 4회 (안내문 포함 회당 3종)', emphasize: true },
  { doc: '부모 개별상담 기록', area: 'join', freq: '상·하반기 각 1회', yearly: '연 2회', emphasize: false },
  { doc: '부모참여프로그램(열린날) 실시기록', area: 'join', freq: '반기별 1회', yearly: '연 2회', emphasize: false },
  { doc: '부모만족도조사 결과 보고서', area: 'join', freq: '연 1회', yearly: '연 1회', emphasize: false },
  { doc: '어린이집 개방(참관) 안내문', area: 'join', freq: '상시 게시', yearly: '연중 1종 게시', emphasize: false },
  { doc: '연계·협력 실시기록 (어린이집 간)', area: 'diverse', freq: '연 2회 이상', yearly: '연 2회', emphasize: false },
  { doc: '연계·협력 실시기록 (지역사회)', area: 'diverse', freq: '연 2회 이상', yearly: '연 2회', emphasize: false },
];

export function getDoc(id) {
  return DOCS.find((d) => d.id === id);
}

export function docsByArea(areaId) {
  return DOCS.filter((d) => d.area === areaId);
}
