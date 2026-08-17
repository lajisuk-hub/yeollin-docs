// 열린어린이집 평가항목별 문서 정의 (2026 교육부 선정·운영 기준 기반)
// 각 문서: 입력필드(fields) + AI 초안 규격(ai) + 출력 블록 생성(build)
// 블록 타입: title, meta, heading, para, kv(라벨/값 표), table(머리글+행), note, sign

// 달력(월 선택)에서 고른 값 '2025-10' → '2025년 10월'.
// 예전에 직접 글자로 적어 둔 값은 그대로 보여준다(저장된 내용 호환).
export function monthText(v) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(v || '').trim());
  return m ? `${m[1]}년 ${Number(m[2])}월` : (v || '');
}

// 예전에 손으로 적어 둔 시기를 달력 값으로 바꿔 준다.
// '2025년 10월' → '2025-10'. 알아볼 수 없는 값(오타 등)은 빈칸으로 두어 다시 고르게 한다.
export function toMonthValue(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = /^(\d{4})\s*[년.\-/ ]\s*(\d{1,2})/.exec(s);
  if (!m) return '';
  const mm = Number(m[2]);
  return mm >= 1 && mm <= 12 ? `${m[1]}-${String(mm).padStart(2, '0')}` : '';
}

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
      { name: '공간 개방성', pt: 20, freq: '상시 (현장확인)', note: '참관실이 전체 보육실에 있으면 20점 / 복도에서 보육실로 통하는 창문이 전체에 있으면 17점 / 보육실 문에 투명창(전체)만 있으면 15점(참관실 1개 이상이면 +2점). 투명창은 성인 상반신 높이에, 시트지·커튼 없이 상시 안이 보이는 것만 인정.' },
      { name: '부모 공용공간', pt: 5, freq: '상시 (현장확인)', note: '부모대기실·상담실 등 1곳 이상 + 게시판·건의함·육아책자 등 기본설비. 현관 등에 두면 영유아 이동통로를 막지 않아야 함.' },
      { name: '온라인 소통창구', pt: 10, freq: '월 1회 이상', note: '홈페이지·블로그·밴드 등 양방향 소통, 전체 부모 공개. ⚠️ 12개월 중 9개월(70%) 이상만 하면 10점이 아니라 부분점수 5점 — 빠지는 달 없이 매달!' },
    ],
  },
  {
    id: 'join', area: '2. 참여성', points: 35, min: 25, color: '#1F6FB2',
    items: [
      { name: '부모 개별상담', pt: 5, freq: '연 2회 (상·하반기 각 1회)', note: '상반기(3~8월)·하반기(9~2월) 각 1회, 재원 영유아 90% 이상과 상담. 대면이 어려우면 전화상담 가능하나 기록이 있어야 함.' },
      { name: '운영위원회 / 총회', pt: 10, freq: '분기별 1회 (연 4회)', note: '분기는 어린이집 회계연도 기준(1분기 3월 / 2분기 6~8월 / 3분기 9~11월 / 4분기 12~2월) — 특히 1분기는 3월에 열어야 인정. 운영규정·개최공지·회의록·결과공지 모두 필요.' },
      { name: '부모참여프로그램 (열린어린이집의 날)', pt: 5, freq: '반기별 1회 (연 2회)', note: '연간계획 + 실시횟수(반기별 1회) + 실시기록을 모두 갖춰야 5점. ⚠️ 계획 없이 실시기록만 있으면 2점. 기록에는 운영일시·참석자·운영내용 포함.' },
      { name: '부모만족도 조사', pt: 10, freq: '연 1회', note: '전체 부모 대상 연 1회. 설문지는 제출하지 않고 결과기록만 제출(별지 제8호 서식 준용), 결과를 전체 부모에게 안내.' },
      { name: '부모 어린이집 참관', pt: 5, freq: '연중 상시', note: '참관안내문 상시 게시(참관자격·시기·방법) + 상시 참관운영 모두 충족 (별지 제6·7호 서식).' },
    ],
  },
  {
    id: 'diverse', area: '3. 다양성', points: 15, min: 5, color: '#C77A2B',
    items: [
      { name: '어린이집 간 연계·협력', pt: 10, freq: '연 2회 이상', note: '타 어린이집과 공동 프로그램·행사·교재교구 공동구매·자원 공유 등 연 2회 이상. 아래 지역사회 연계 항목과 같은 활동으로 중복 인정 가능.' },
      { name: '부모참여활동 지역사회 연계', pt: 5, freq: '연 2회 이상', note: '부모가 함께 참여하는 지역사회 연계활동 연 2회 이상 (영유아만 대상은 미인정). 기록에 운영일시·부모 참석자·연계내용·안내문 포함.' },
    ],
  },
  {
    id: 'local', area: '4. 지자체 자체기준', points: 15, min: 5, color: '#6B7280',
    items: [
      { name: '지자체가 정한 자체 선정기준', pt: 15, freq: '지자체별 상이', note: '예) 사업설명회 참여, 재무회계교육 또는 문서컨설팅 참여 등 — 지역(관할 시·군·구)마다 다르니 우리 지역 공고를 꼭 확인. ※ 아동학대 행정처분 이력이 있으면 열린어린이집 선정에서 제외.' },
    ],
  },
];

// 2026년 특히 확인해야 할 핵심 포인트 (놓치기 쉬운 세부기준 · 첫 화면 강조용)
// hot=true 는 감점·제외로 이어질 수 있어 가장 주의해야 할 것
export const KEY_2026 = [
  { hot: true, t: '아동학대 행정처분 이력이 있으면 선정에서 제외', d: '점수와 무관하게 아동학대로 행정처분을 받은 이력이 있으면 열린어린이집 선정 대상에서 제외됩니다. 가장 먼저 확인하세요.' },
  { hot: true, t: '온라인 소통은 “빠지는 달 없이” 매달', d: '월 1회 이상 전체 부모에게 공개로 올려야 10점입니다. 1년 12개월 중 9개월(70%) 이상만 하면 부분점수 5점만 받습니다.' },
  { hot: true, t: '부모참여프로그램은 “연간계획 + 기록” 둘 다', d: '연간운영계획 없이 실시기록만 반기별 1회 이상이면 5점이 아니라 2점만 받습니다. 계획서를 꼭 함께 갖추세요.' },
  { hot: false, t: '운영위원회 분기는 “회계연도” 기준', d: '1분기 3월 / 2분기 6~8월 / 3분기 9~11월 / 4분기 12~2월. 특히 1분기는 3월 안에 열어야 인정됩니다.' },
  { hot: false, t: '만족도조사는 “설문지”가 아니라 “결과기록”', d: '조사한 설문지 자체는 제출하지 않습니다. 별지 제8호 서식을 준용해 조사하고, 결과기록만 정리해 제출·전체 부모에게 안내하세요.' },
  { hot: false, t: '다양성 두 항목은 중복 인정 가능', d: '‘어린이집 간 연계·협력’과 ‘부모참여활동의 지역사회 연계’는 같은 활동으로 양쪽 모두 인정될 수 있습니다.' },
];

// 공통 머리(어린이집 이름/작성일)
const commonHead = [
  { key: 'centerName', label: '어린이집 이름', type: 'text', placeholder: '예) 햇살어린이집', required: true },
];

export const DOCS = [
  // ───────────────────────── 개방성 ─────────────────────────
  // 개방성은 현장 상태로 확인하는 영역이라 만들 문서가 없습니다. (자체 체크리스트로 진행)

  // ───────────────────────── 참여성 ─────────────────────────
  {
    id: 'counsel',
    area: 'join',
    name: '부모 개별상담 운영 결과 정리 (연 2회)',
    freq: '연 2회 (상·하반기 각 1회)',
    item: '2-가. 부모 개별상담 (5점)',
    desc: '상·하반기 각 회차별로 공지문·신청서(사진 또는 PDF), 시기, 참여인원, 상담자료(문서 업로드 시 AI 분석), 상담사진을 넣어 한 문서로 정리합니다.',
    fields: [
      ...commonHead,

      { type: 'section', label: '［1회차］' },
      { key: 's1notice', label: '① 상담 공지문 (사진 또는 PDF)', type: 'attach' },
      { key: 's1apply', label: '② 부모상담 신청서 (사진 또는 PDF)', type: 'attach' },
      { key: 's1period', label: '③ 시기 (달력에서 고르세요)', type: 'month' },
      { key: 's1count', label: '④ 참여 인원', type: 'text', placeholder: '예) 전체 40명 중 38명 참여' },
      { key: 's1material', label: '⑤ 상담한 자료 (문서 업로드 또는 붙여넣기 → AI 분석)', type: 'material', placeholder: '한글·워드·PDF·텍스트 문서를 올리면 내용이 자동으로 들어옵니다. 직접 붙여넣어도 됩니다.' },
      { key: 's1photos', label: '⑥ 상담 사진 (여러 장 가능)', type: 'images' },

      { type: 'section', label: '［2회차］  (아직이면 비워두세요)' },
      { key: 's2notice', label: '① 상담 공지문 (사진 또는 PDF)', type: 'attach' },
      { key: 's2apply', label: '② 부모상담 신청서 (사진 또는 PDF)', type: 'attach' },
      { key: 's2period', label: '③ 시기 (달력에서 고르세요)', type: 'month' },
      { key: 's2count', label: '④ 참여 인원', type: 'text', placeholder: '예) 전체 40명 중 39명 참여' },
      { key: 's2material', label: '⑤ 상담한 자료 (문서 업로드 또는 붙여넣기 → AI 분석)', type: 'material', placeholder: '2회차 상담 자료를 올리거나 붙여넣으세요. 아직 안 했으면 비워두세요.' },
      { key: 's2photos', label: '⑥ 상담 사진 (여러 장 가능)', type: 'images' },
    ],
    ai: {
      button: 'AI로 상담내용 분석·정리',
      keys: ['purpose', 's1summary', 's1topics', 's2summary', 's2topics'],
      system: '당신은 어린이집 부모 개별상담 운영 결과를 정리하는 전문가입니다. 원장이 올린 상담 원자료를 분석해 공식 문서 문어체로 정리합니다. 없는 사실은 지어내지 않으며, 원자료가 비어 있는 회차의 키는 빈 문자열("")로 둡니다. 큰따옴표(")는 절대 쓰지 않습니다.\n출력 키 설명:\n- purpose: 부모 개별상담의 필요성과 목적을 완성도 높은 공식 문어체 3~4문장으로 작성(영유아 발달·생활 모습의 정기적 공유, 가정과 어린이집의 일관된 양육 연계, 부모 참여와 신뢰 제고를 통한 열린 보육환경 조성 등 포함). 어린이집 고유 정보는 지어내지 않고 보편적 취지로 서술.\n- s1summary: 1회차 종합 정리 2~3문장(참여 규모와 전반적 상담 분위기 중심).\n- s1topics: 1회차 주요 상담 내용을 주제별로 묶어 한눈에 보이게 정리. 각 줄을 · 로 시작하고 줄바꿈(\\n)으로 구분. 예: 발달·놀이, 건강·수면·식사, 또래관계, 가정연계 요청 등.\n- s2summary, s2topics: 2회차에 대해 동일한 방식. 2회차 원자료가 없으면 둘 다 "".\n아래 JSON 하나만 출력합니다. {"purpose":"","s1summary":"","s1topics":"","s2summary":"","s2topics":""}',
      user: (v) => `어린이집: ${v.centerName || ''}\n\n[1회차] 시기: ${monthText(v.s1period)} / 참여: ${v.s1count || ''}\n[1회차] 상담 원자료:\n${v.s1material || '(없음)'}\n\n[2회차] 시기: ${monthText(v.s2period)} / 참여: ${v.s2count || ''}\n[2회차] 상담 원자료:\n${v.s2material || '(없음)'}`,
    },
    build: (v, ai) => {
      const out = [];
      out.push({ type: 'title', text: `${v.centerName || '○○어린이집'} 부모개별상담 성과정리` });

      out.push({ type: 'heading', text: '1. 부모상담의 필요성 및 목적' });
      out.push({ type: 'para', text: ai?.purpose || '부모 개별상담은 영유아의 발달 특성과 어린이집에서의 생활 모습을 부모와 정기적으로 공유하고, 가정에서의 양육 상황을 함께 이해하기 위한 필수적인 소통 과정입니다. 이를 통해 어린이집과 가정이 일관된 양육 방향을 세우고, 영유아 개개인의 성장에 필요한 지원을 적기에 제공할 수 있습니다. 또한 부모의 어린이집 참여와 신뢰를 높여 열린 보육환경을 조성하는 데 그 목적이 있습니다.' });

      out.push({ type: 'heading', text: '2. 상담 실시 결과' });

      const session = (no, notice, apply, rawPeriod, count, summary, topics, material, photos, cap, brk) => {
        const period = monthText(rawPeriod);
        // 회차 사이는 새 쪽으로 강제하지 않고 점선으로만 구분한다 (쪽 중간 공백 방지)
        if (brk) out.push({ type: 'divider' });
        out.push({ type: 'sessionhead', text: period ? `${no} : ${period}` : no });
        out.push({ type: 'attachrow', cols: [
          { title: '상담 공지문', items: notice, emptyText: '※ 공지문 사진·PDF를 첨부해 주세요.' },
          { title: '부모상담 신청서', items: apply, emptyText: '※ 신청서 사진·PDF를 첨부해 주세요.' },
        ] });
        out.push({ type: 'kv', rows: [['시기', period], ['참여 인원', count]] });
        if (summary || material) {
          out.push({ type: 'subheading', text: `${no} 상담의 주요 핵심 정리` });
          out.push({ type: 'para', text: summary || '' });
          out.push({ type: 'para', text: topics || material || '' });
        }
        if (Array.isArray(photos) && photos.length) {
          // 사진도 새 쪽으로 밀지 않고 이어서 넣는다 (앞 쪽이 텅 비는 것 방지)
          out.push({ type: 'subheading', text: `${no} 상담 사진` });
          out.push({ type: 'images', items: photos });
        }
      };

      session('1회차', v.s1notice, v.s1apply, v.s1period, v.s1count, ai?.s1summary, ai?.s1topics, v.s1material, v.s1photos, '1회차 상담 사진', false);

      const arr = (x) => Array.isArray(x) && x.length;
      const has2 = v.s2period || v.s2count || v.s2material || arr(v.s2photos) || arr(v.s2notice) || arr(v.s2apply) || ai?.s2summary;
      if (has2) {
        session('2회차', v.s2notice, v.s2apply, v.s2period, v.s2count, ai?.s2summary, ai?.s2topics, v.s2material, v.s2photos, '2회차 상담 사진', true);
      }

      out.push({ type: 'note', text: '※ 본 문서는 부모 개별상담(연 2회) 운영 결과 증빙자료입니다. 상담 원자료는 어린이집에 별도 보관합니다.' });
      return out;
    },
  },
  // 가지고 있는 자료를 올려 한 흐름으로 정리하는 방식 (권장)
  {
    id: 'committee-tidy',
    area: 'join',
    tidy: 'committee',
    name: '운영위원회 서류 정리 (연 4회)',
    freq: '분기별 1회 (25년 4분기 ~ 26년 3분기)',
    item: '2-나. 어린이집 운영위원회 (10점)',
    desc: '가지고 있는 회칙·개최 공지문·회의록·회의결과서를 올리면 AI가 읽어서, 25년 4분기 → 26년 1분기 → 2분기 → 3분기 순서로 한 문서로 정리합니다. 회칙과 위원 명단은 연도별로 한 번만 올리면 됩니다.',
    fields: [],
    build: () => [],
  },
  {
    id: 'committee-minutes',
    area: 'join',
    legacy: true,
    hidden: true,   // 목록에서 감춤 — 위의 '운영위원회 서류 정리'가 이 내용을 모두 포함한다
    name: '운영위원회 회의록',
    freq: '분기별 1회 이상 (연 4회)',
    item: '2-나. 어린이집 운영위원회 (10점)',
    desc: '한 분기 회의록만 한 장으로 만듭니다. (위의 "운영위원회 서류 정리"를 쓰면 네 차수를 한 번에 정리할 수 있습니다.)',
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
    legacy: true,
    hidden: true,   // 목록에서 감춤 — 위의 '운영위원회 서류 정리'가 이 내용을 모두 포함한다
    name: '운영위원회 안내문 (개최/결과)',
    freq: '회의마다 (개최 전·후)',
    item: '2-나. 어린이집 운영위원회 (10점)',
    desc: '개최 안내문 또는 회의결과 안내문만 한 장씩 만듭니다. (위의 "운영위원회 서류 정리"에 이미 들어 있습니다.)',
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
  { doc: '온라인 소통창구 게시글 (홈페이지·밴드 등에 직접 게시)', area: 'open', freq: '월 1회 이상', yearly: '연 12회 이상', emphasize: true },
  { doc: '운영위원회 회의록 + 개최·결과 안내문', area: 'join', freq: '분기별 1회', yearly: '연 4회 (안내문 포함 회당 3종)', emphasize: true },
  { doc: '부모 개별상담 운영 결과 정리', area: 'join', freq: '상·하반기 각 1회', yearly: '연 2회 (한 문서로 정리)', emphasize: false },
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
  // hidden 문서는 목록에 보여주지 않는다 (예전 방식으로 만들던 것)
  return DOCS.filter((d) => d.area === areaId && !d.hidden);
}

// 이 문서를 마친 뒤 이어서 만들 문서 (참여성 → 다양성 순서, 마지막이면 null)
export function getNextDoc(id) {
  const list = DOCS.filter((d) => !d.hidden);
  const i = list.findIndex((d) => d.id === id);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}
