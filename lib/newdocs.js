// ── 서류를 "아예 새로 만드는" 길 전용 문서 정의 ──
// 기존 서류 분석·정리(lib/docs.js)와 완전히 분리된 흐름.
// 여기서는 원장님이 가진 자료가 없다고 보고, 기본사항(어린이집·교직원·반·원아)만으로
// 필요한 서류 묶음을 처음부터 만들어 낸다.
//
// 블록 타입: title, lead, kv, heading, sessionhead, para, note, table, blank, sign, pagebreak

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const ymd = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
};

// 기본사항 → 반 목록 (담임 이름 붙여서)
export function classList(basic) {
  const staff = basic?.staff || [];
  return staff.flatMap((s) => (s.classes || []).map((c) => ({ ...c, teacher: s.name, role: s.role })));
}

export const NEW_DOCS = [
  {
    id: 'counsel-new',
    name: '부모 개별상담 운영 결과',
    area: '2-가. 부모 개별상담 (5점)',
    freq: '연 2회 (상·하반기 각 1회)',
    ready: true,
    wizard: true, // 한 단계씩 물어보며 만드는 방식 (app/CounselWizard.js)
    desc: '가진 자료가 없어도 됩니다. 1회차부터 상담 시기 → 공지문 → 신청서 → 상담 내용 → 사진 순서로 한 단계씩 물어보며 만들고, 1·2회차를 한 문서로 저장합니다.',
    makes: ['1·2회차 상담 공지문', '상담 신청서', '상담 실시 결과 정리', '상담 사진', 'PDF · 한글(hwpx) 저장'],
    fields: [
      { key: 'round', label: '회차', type: 'select', options: ['1회차', '2회차'], required: true },
      { key: 'from', label: '상담 시작일', type: 'date', required: true },
      { key: 'to', label: '상담 종료일', type: 'date' },
      { key: 'method', label: '상담 방법', type: 'select', options: ['대면 상담', '전화 상담', '대면·전화 병행'] },
      { key: 'place', label: '상담 장소', type: 'text', placeholder: '예) 어린이집 상담실' },
      { key: 'due', label: '신청서 제출 기한', type: 'date' },
      { key: 'focus', label: '이번 상담에서 중점적으로 나누고 싶은 내용 (선택)', type: 'textarea', placeholder: '예) 적응 정도와 또래관계, 기본생활습관, 가정에서의 놀이 지원' },
      { type: 'section', label: '만들 서류 고르기' },
      { key: 'incNotice', label: '① 부모 상담 안내문', type: 'check' },
      { key: 'incApply', label: '② 상담 신청서 양식 (부모 작성용)', type: 'check' },
      { key: 'incSchedule', label: '③ 반별 상담 일정표', type: 'check' },
      { key: 'incRecord', label: '④ 원아별 상담 기록지 (원아 수만큼 장수가 늘어납니다)', type: 'check' },
      { key: 'incResult', label: '⑤ 상담 운영 결과 정리', type: 'check' },
    ],
    defaults: { round: '1회차', method: '대면 상담', place: '어린이집 상담실', incNotice: true, incApply: true, incSchedule: true, incRecord: true, incResult: true },

    ai: {
      button: 'AI로 문장 만들기',
      keys: ['purpose', 'noticeBody', 'resultSummary', 'plan'],
      system:
        '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 열린어린이집 선정 심사에 제출하는 부모 개별상담 관련 문서의 문장을 씁니다. ' +
        '따뜻하고 정중한 존댓말, 공문서다운 담백한 문체로 씁니다. 큰따옴표(")는 절대 쓰지 않습니다. 실제로 확인되지 않은 숫자나 성과를 지어내지 않고, 계획과 취지 중심으로 씁니다. ' +
        '아래 JSON 하나만 출력합니다. ' +
        '{"purpose":"상담의 필요성과 목적 4~5문장","noticeBody":"부모에게 보내는 안내문 본문 4~6문장(인사-취지-기간과 방법 안내-신청 방법-협조 부탁)","resultSummary":"운영 결과 정리에 넣을 총평 4~5문장(실시 개요와 상담에서 주로 다룬 내용 중심)","plan":"상담 결과를 보육에 반영하기 위한 향후 계획 3~4문장"}',
      user: (v, basic) => {
        const cls = classList(basic);
        const kids = cls.reduce((n, c) => n + (c.children?.length || 0), 0);
        return [
          `어린이집: ${basic?.centerName || ''}`,
          `반 구성: ${cls.map((c) => `${c.className || '반'}(${c.age || '연령미상'}, ${c.children?.length || c.count || 0}명, 담임 ${c.teacher || ''})`).join(' / ') || '미입력'}`,
          `전체 원아 수: ${kids}명`,
          `상담 회차: ${v.round || ''}`,
          `상담 기간: ${ymd(v.from)} ~ ${ymd(v.to)}`,
          `상담 방법: ${v.method || ''}`,
          `상담 장소: ${v.place || ''}`,
          `원장이 이번 상담에서 중점적으로 나누고 싶은 내용: ${v.focus || '특별한 요청 없음'}`,
        ].join('\n');
      },
    },

    build: (v, ai, basic) => {
      const center = basic?.centerName?.trim() || '○○어린이집';
      const director = (basic?.staff || []).find((s) => s.role === '원장')?.name || '';
      const cls = classList(basic);
      const period = v.to ? `${ymd(v.from)} ~ ${ymd(v.to)}` : ymd(v.from);
      const totalKids = cls.reduce((n, c) => n + (c.children?.length || 0), 0);
      const blocks = [];
      const nextPage = () => { if (blocks.length) blocks.push({ type: 'pagebreak' }); };

      // ① 부모 상담 안내문
      if (v.incNotice) {
        blocks.push({ type: 'title', text: `${v.round} 부모 개별상담 안내` });
        blocks.push({ type: 'lead', text: `${center}` });
        blocks.push({
          type: 'para',
          text: ai?.noticeBody
            || `안녕하세요, ${center}입니다. 우리 아이의 어린이집 생활을 함께 나누고 가정과 어린이집이 같은 방향으로 아이를 지원하기 위해 ${v.round} 부모 개별상담을 실시합니다. 아래 안내를 확인하시고 상담 신청서를 작성해 담임교사에게 제출해 주시기 바랍니다. 바쁘시더라도 소중한 시간 내어 참여해 주시기를 부탁드립니다.`,
        });
        blocks.push({
          type: 'kv',
          rows: [
            ['상담 기간', period],
            ['상담 방법', v.method || ''],
            ['상담 장소', v.place || ''],
            ['신청 방법', `상담 신청서를 작성하여 담임교사에게 제출${v.due ? ` (제출 기한 : ${ymd(v.due)})` : ''}`],
            ['대상', `전체 재원 영유아 가정 (${totalKids}명)`],
          ],
        });
        blocks.push({ type: 'note', text: '※ 신청하신 희망 시간은 반별 일정에 따라 조정될 수 있으며, 확정된 일시는 담임교사가 개별적으로 안내드립니다.' });
        blocks.push({ type: 'sign', date: today(), role: `${center} 원장`, name: director });
      }

      // ② 상담 신청서 양식
      if (v.incApply) {
        nextPage();
        blocks.push({ type: 'title', text: '부모 개별상담 신청서' });
        blocks.push({ type: 'para', text: `아래 내용을 작성하여 ${v.due ? `${ymd(v.due)}까지 ` : ''}담임교사에게 제출해 주시기 바랍니다.` });
        blocks.push({
          type: 'kv',
          rows: [
            ['반 이름', ''],
            ['영유아 이름', ''],
            ['작성자(보호자)', '           (관계 :          )'],
            ['연락처', ''],
            ['희망 일시 1지망', '        월      일      시     분'],
            ['희망 일시 2지망', '        월      일      시     분'],
            ['희망 상담 방법', '□ 대면 상담      □ 전화 상담'],
          ],
        });
        blocks.push({ type: 'heading', text: '상담에서 나누고 싶은 내용' });
        blocks.push({ type: 'blank', lines: 6 });
        blocks.push({ type: 'note', text: '※ 작성해 주신 내용은 상담 준비 자료로만 사용되며, 상담 후 어린이집에서 안전하게 보관합니다.' });
        blocks.push({ type: 'sign', date: '        년      월      일', role: '보호자', name: '                 ' });
      }

      // ③ 반별 상담 일정표
      if (v.incSchedule) {
        nextPage();
        blocks.push({ type: 'title', text: `${v.round} 반별 부모 개별상담 일정표` });
        blocks.push({ type: 'kv', rows: [['어린이집', center], ['상담 기간', period], ['상담 방법', v.method || '']] });
        if (!cls.length) {
          blocks.push({ type: 'note', text: '※ 기본사항에 반과 원아를 등록하면 반별 명단이 자동으로 채워집니다.' });
        }
        cls.forEach((c) => {
          blocks.push({ type: 'sessionhead', text: `${c.className || '반 이름 미입력'}${c.age ? ` (${c.age})` : ''} · 담임 ${c.teacher || ''}` });
          const rows = (c.children?.length ? c.children : ['', '', '', '']).map((name, i) => [String(i + 1), name, '', '', '']);
          blocks.push({ type: 'table', head: ['번호', '영유아 이름', '상담 일시', '방법', '비고'], widths: ['10%', '24%', '32%', '16%', '18%'], rows });
        });
        blocks.push({ type: 'note', text: '※ 상담 일시는 신청서를 받은 뒤 담임교사가 조정하여 기록합니다.' });
      }

      // ④ 원아별 상담 기록지
      if (v.incRecord) {
        cls.forEach((c) => {
          const kids = c.children?.length ? c.children : [''];
          kids.forEach((name) => {
            nextPage();
            blocks.push({ type: 'title', text: '부모 개별상담 기록지' });
            blocks.push({
              type: 'kv',
              rows: [
                ['어린이집', center],
                ['반 / 연령', `${c.className || ''} ${c.age ? `/ ${c.age}` : ''}`],
                ['영유아 이름', name],
                ['담임교사', c.teacher || ''],
                ['상담 일시', ''],
                ['상담 방법 / 참석자', ''],
              ],
            });
            blocks.push({ type: 'heading', text: '1. 보호자가 요청한 내용' });
            blocks.push({ type: 'blank', lines: 4 });
            blocks.push({ type: 'heading', text: '2. 어린이집 생활 (놀이·또래관계·기본생활습관)' });
            blocks.push({ type: 'blank', lines: 5 });
            blocks.push({ type: 'heading', text: '3. 상담에서 나눈 주요 내용' });
            blocks.push({ type: 'blank', lines: 5 });
            blocks.push({ type: 'heading', text: '4. 가정 연계 및 지원 계획' });
            blocks.push({ type: 'blank', lines: 4 });
            blocks.push({ type: 'sign', date: '        년      월      일', role: '담임교사', name: c.teacher || '' });
          });
        });
      }

      // ⑤ 상담 운영 결과 정리
      if (v.incResult) {
        nextPage();
        blocks.push({ type: 'title', text: `${center} ${v.round} 부모 개별상담 운영 결과` });
        blocks.push({
          type: 'kv',
          rows: [
            ['상담 회차', v.round || ''],
            ['상담 기간', period],
            ['상담 방법 / 장소', `${v.method || ''}${v.place ? ` / ${v.place}` : ''}`],
            ['대상', `전체 재원 영유아 가정 (${totalKids}명)`],
          ],
        });
        blocks.push({ type: 'heading', text: '1. 상담의 필요성 및 목적' });
        blocks.push({
          type: 'para',
          text: ai?.purpose
            || '부모 개별상담은 영유아의 발달과 어린이집 생활을 보호자와 함께 이해하고, 가정과 어린이집이 같은 방향으로 아이를 지원하기 위해 실시합니다. 상담을 통해 보호자의 궁금한 점과 요구를 직접 듣고, 어린이집의 보육 방향과 아이의 성장 모습을 상세히 나눕니다. 이는 열린어린이집이 지향하는 부모 참여와 소통의 기본이 되는 활동입니다.',
        });
        blocks.push({ type: 'heading', text: '2. 반별 상담 실시 현황' });
        blocks.push({
          type: 'table',
          head: ['반 이름', '연령', '담임교사', '대상 인원', '상담 실시 인원', '실시율'],
          widths: ['20%', '14%', '16%', '16%', '18%', '16%'],
          rows: cls.length
            ? cls.map((c) => [c.className || '', c.age || '', c.teacher || '', `${c.children?.length || c.count || 0}명`, '', ''])
            : [['', '', '', '', '', '']],
        });
        blocks.push({ type: 'note', text: '※ 상담 실시 인원과 실시율은 상담을 마친 뒤 기록합니다. (재원 영유아의 90% 이상 실시 권장)' });
        blocks.push({ type: 'heading', text: '3. 상담 운영 결과' });
        blocks.push({ type: 'para', text: ai?.resultSummary || '' });
        blocks.push({ type: 'heading', text: '4. 향후 계획' });
        blocks.push({ type: 'para', text: ai?.plan || '' });
        blocks.push({ type: 'sign', date: today(), role: `${center} 원장`, name: director });
      }

      return blocks;
    },
  },

  // 아래 서류들은 같은 방식으로 이어서 추가 예정
  {
    id: 'committee-new',
    name: '운영위원회 (개최 안내문·회의록·결과 안내문)',
    area: '2-나. 운영위원회 (10점)',
    freq: '분기별 1회 (연 4회)',
    ready: true,
    wizard: 'committee', // 한 단계씩 물어보며 만드는 방식 (app/CommitteeWizard.js)
    desc: '가진 자료가 없어도 됩니다. 분기를 하나 골라 일시 → 안건 → 개최 안내문 → 회의록 → 결과 안내문 → 사진 순서로 만들고, 네 분기를 한 문서로 저장합니다.',
    makes: ['운영위원 명단', '분기별 개최 안내문', '분기별 회의록 (논의 내용·결정 사항)', '분기별 회의결과 안내문', '회의 사진', 'PDF · 한글(hwpx) 저장'],
  },
  {
    id: 'program-new',
    name: '부모참여프로그램 (연간계획 + 실시기록)',
    area: '2-다. 부모참여프로그램 (5점)',
    freq: '반기별 1회 (연 2회)',
    ready: true,
    wizard: 'program', // 한 단계씩 물어보며 만드는 방식 (app/ProgramWizard.js)
    desc: '가진 자료가 없어도 됩니다. 아이 연령·희망 대상만 고르면 월 1회 연간계획을 만들고, 달마다 공지문 → 실시기록 순서로 이어서 만듭니다. 마지막에 분기별 1회만 낼지 월 1회 전부 낼지 고를 수 있습니다. ⚠️ 계획 없이 기록만 있으면 5점이 아니라 2점만 인정됩니다.',
    makes: ['월 1회 연간계획표 (3월~다음 해 2월)', '달마다 부모 공지문 (서식 그림 위에 글 얹기)', '달마다 실시기록·결과보고서 (운영일시·참석자·운영내용)', '활동 사진 (없으면 생략)', '분기별 1회 / 월 1회 선택 정리', 'PDF · 한글(hwpx) 저장'],
  },
  {
    id: 'survey-new',
    name: '부모만족도조사 (설문지·결과 보고서)',
    area: '2-라. 부모만족도 조사 (10점)',
    freq: '연 1회 (전체 부모 대상)',
    ready: true,
    wizard: 'survey', // 한 단계씩 물어보며 만드는 방식 (app/SurveyWizard.js)
    desc: '조사를 아직 안 하셨어도 됩니다. 몇 명에게 조사할지 정하면 설문지를 만들고, 결과 점수(샘플 자동 생성 가능)로 그래프가 들어간 결과보고서까지 만듭니다. ⚠️ 심사 제출은 설문지가 아니라 결과 기록이며, 결과를 전체 부모에게 안내해야 합니다.',
    makes: ['부모만족도 설문지 (영역 5개 · 문항 15개 + 수요조사)', '조사 규모·회신율 정리', '영역별 평균 점수 막대그래프', '잘된 점 · 개선 의견 · 어린이집 조치사항', 'PDF · 한글(hwpx) 저장'],
  },
  {
    id: 'link-new',
    name: '연계·협력 활동 (계획·실시기록)',
    area: '3. 다양성 (15점)',
    freq: '항목마다 연 2회 이상',
    ready: true,
    wizard: 'link', // 한 단계씩 물어보며 만드는 방식 (app/LinkWizard.js)
    desc: '연계할 곳만 고르면 연간계획을 만들고, 활동마다 안내문 → 실시기록 순서로 이어서 만듭니다. 어린이집 간 연계(10점)와 지역사회 연계(5점)를 활동마다 표시해 두면 마지막에 항목별로 몇 회를 채웠는지 보여줍니다. ⚠️ 지역사회 연계는 부모가 함께 참여한 활동만 인정됩니다.',
    makes: ['연계·협력 활동의 필요성', '연간계획표 (시기·활동명·연계 대상·인정 항목)', '활동별 안내문', '활동별 실시기록 (운영일시·참석자·활동내용)', '심사 항목별 실시 현황 표', 'PDF · 한글(hwpx) 저장'],
  },
];

export function getNewDoc(id) {
  return NEW_DOCS.find((d) => d.id === id);
}
