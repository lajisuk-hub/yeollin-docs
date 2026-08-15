// 부모개별상담 운영 결과 문서 조립 (1·2회차 한 문서)
// 화면 미리보기 블록과 한글(hwpx) 문단을 같은 내용에서 만든다.

// 안내문 배경 그림 (원장님이 준 서식). 원장님이 다른 그림을 올리면 그것으로 바뀐다.
export const DEFAULT_BG = '/notice-bg.png';

export const emptyRound = () => ({
  from: '', to: '', method: '대면 상담', place: '어린이집 상담실',
  notice: '', noticeFeedback: '',
  noticeEyebrow: '', noticeGreeting: '', noticeItems: '', noticeNotes: '', noticeQuestions: '',
  noticeBg: DEFAULT_BG, noticeTop: 30, noticeBottom: 18, noticeScale: 1, noticeAsk: true,
  apply: '', applyFeedback: '',
  count: '', memo: '', summary: '', summaryFeedback: '',
  photos: [],
});

const ymd = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
};

export function periodText(r) {
  if (!r?.from) return '';
  return r.to && r.to !== r.from ? `${ymd(r.from)} ~ ${ymd(r.to)}` : ymd(r.from);
}

export function roundHasContent(r) {
  return !!(r && (r.from || r.notice || r.noticeGreeting || r.apply || r.summary || (r.photos || []).length));
}

// 상담 기간·방법으로 안내문 항목 기본값 만들기 (원장님이 고칠 수 있게 '라벨 : 내용' 줄로)
export function defaultNoticeItems(r) {
  return [
    `상담 기간 : ${periodText(r) || '        년      월      일 ~      월      일'}`,
    `상담 방법 : ${r.method || '대면 상담'}`,
    '상담 시간 : 1회 약 20분 내외',
    `상담 장소 : ${r.place || '어린이집 각 반 교실'}`,
    '상담 신청 : 상담 신청서에 희망 시간을 적어 담임교사에게 제출해 주세요.',
  ].join('\n');
}

export const DEFAULT_QUESTIONS = [
  '최근 우리 아이가 가정에서 가장 즐겨 하는 놀이와 관심사는 무엇인가요?',
  '최근 아이의 모습에서 성장했다고 느껴지는 부분이 있나요?',
  '생활습관, 언어, 또래관계, 정서·행동 중에서 함께 이야기 나누고 싶은 부분이 있나요?',
  '어린이집 생활과 관련하여 교사에게 궁금한 점이 있다면 미리 생각해 주세요.',
];

export const DEFAULT_NOTES = [
  '원활한 상담 진행을 위해 정해진 상담 시간을 지켜주시기 바랍니다.',
  '일정 변경이 필요한 경우 미리 어린이집 또는 담임교사에게 연락해 주세요.',
];

// 라벨에 맞는 아이콘 고르기
function iconFor(label) {
  if (/기간|날짜|일정/.test(label)) return 'calendar';
  if (/방법|방식/.test(label)) return 'people';
  if (/시간/.test(label)) return 'clock';
  if (/장소|위치/.test(label)) return 'pin';
  if (/신청|제출|접수/.test(label)) return 'doc';
  return 'dot';
}

// 안내문(가정통신문) 블록 만들기
export function noticeBlock(r, i, center) {
  const toList = (s) => String(s || '').split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const items = toList(r.noticeItems || defaultNoticeItems(r)).map((line) => {
    const clean = line.replace(/^[◈◆▶▷·\-*]\s*/, '');
    const m = clean.match(/^([^:：]{1,12})\s*[:：]\s*([\s\S]*)$/);
    const label = m ? m[1].trim() : '';
    return { icon: iconFor(label), label, value: m ? m[2].trim() : clean };
  });
  return {
    type: 'notice',
    round: `${i + 1}회차`,
    center,
    bg: r.noticeBg === undefined ? DEFAULT_BG : r.noticeBg,
    top: Number(r.noticeTop) || 30,
    bottom: Number(r.noticeBottom) || 18,
    textScale: Number(r.noticeScale) || 1,
    eyebrow: r.noticeEyebrow || '함께 이야기하고, 함께 성장합니다',
    greeting: r.noticeGreeting || r.notice || '',
    items,
    notes: toList(r.noticeNotes).length ? toList(r.noticeNotes) : DEFAULT_NOTES,
    // 질문 상자를 빼면 글자가 그만큼 커진다
    questions: r.noticeAsk === false ? [] : (toList(r.noticeQuestions).length ? toList(r.noticeQuestions) : DEFAULT_QUESTIONS),
  };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const PURPOSE =
  '부모 개별상담은 영유아의 발달과 어린이집 생활을 보호자와 함께 이해하고, 가정과 어린이집이 같은 방향으로 아이를 지원하기 위해 실시합니다. ' +
  '상담을 통해 보호자의 궁금한 점과 요구를 직접 듣고, 어린이집의 보육 방향과 아이의 성장 모습을 자세히 나눕니다. ' +
  '우리 어린이집은 열린어린이집 운영 취지에 따라 연 2회(상·하반기 각 1회) 부모 개별상담을 실시하고 그 결과를 보육과정 운영에 반영하고 있습니다.';

// 한 회차 분량의 블록
function roundBlocks(r, i, center) {
  const b = [];
  const n = i + 1;
  b.push({ type: 'sessionhead', text: `${n}회차 : ${periodText(r) || '시기 미입력'}` });

  b.push({ type: 'heading', text: `${n}-1. 부모상담 공지문 (가정통신문)` });
  b.push(noticeBlock(r, i, center));

  b.push({ type: 'heading', text: `${n}-2. 부모상담 신청서` });
  b.push({ type: 'para', text: r.apply || '' });
  b.push({
    type: 'kv',
    rows: [
      ['반 / 영유아 이름', ''],
      ['보호자 성함 / 관계', ''],
      ['희망 일시 1지망', ''],
      ['희망 일시 2지망', ''],
      ['희망 상담 방법', '□ 대면 상담      □ 전화 상담'],
    ],
  });

  b.push({ type: 'heading', text: `${n}-3. 상담 실시 결과` });
  b.push({
    type: 'kv',
    rows: [
      ['상담 시기', periodText(r)],
      ['상담 방법 / 장소', `${r.method || ''}${r.place ? ` / ${r.place}` : ''}`],
      ['참여 인원', r.count || ''],
    ],
  });
  b.push({ type: 'para', text: r.summary || '' });

  const photos = (r.photos || []).filter(Boolean);
  if (photos.length) {
    b.push({ type: 'heading', text: `${n}-4. 상담 사진` });
    b.push({ type: 'photos', items: photos });
  }
  return b;
}

export function buildCounselDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const director = (basic?.staff || []).find((s) => s.role === '원장')?.name || '';
  const rounds = data?.rounds || [];
  const blocks = [{ type: 'title', text: `${center} 부모개별상담 성과정리` }];

  blocks.push({ type: 'heading', text: '1. 부모상담의 필요성 및 목적' });
  blocks.push({ type: 'para', text: PURPOSE });

  rounds.forEach((r, i) => {
    if (!roundHasContent(r)) return;
    blocks.push({ type: 'pagebreak' });
    roundBlocks(r, i, center).forEach((x) => blocks.push(x));
  });

  blocks.push({ type: 'sign', date: today(), role: `${center} 원장`, name: director });
  return blocks;
}

// 화면 블록 → 한글(hwpx) 문단 (사진·표는 글로 바꿔 넣는다)
export function toHwpxBlocks(blocks) {
  const out = [];
  blocks.forEach((b) => {
    if (b.type === 'title') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'heading' || b.type === 'sessionhead') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'kv') b.rows.forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${v || ''}` }));
    else if (b.type === 'notice') {
      out.push({ kind: 'head', text: `${b.round} 부모 개별상담 안내` });
      if (b.greeting) out.push({ kind: 'body', text: b.greeting });
      out.push({ kind: 'body', text: '[상담 안내]' });
      (b.items || []).forEach((it) => out.push({ kind: 'body', text: `· ${it.label} : ${it.value}` }));
      (b.notes || []).forEach((n) => out.push({ kind: 'body', text: `※ ${n}` }));
      if ((b.questions || []).length) {
        out.push({ kind: 'body', text: '[상담 전, 생각해 오시면 좋아요]' });
        b.questions.forEach((q, i) => out.push({ kind: 'body', text: `${i + 1}. ${q}` }));
      }
      out.push({ kind: 'note', text: b.center });
    }
    else if (b.type === 'photos') out.push({ kind: 'note', text: `※ 상담 사진 ${b.items.filter(Boolean).length}장은 PDF 파일에 들어 있습니다. 한글 문서에는 사진을 직접 붙여 넣어 주세요.` });
    else if (b.type === 'sign') out.push({ kind: 'note', text: `${b.date}    ${b.role} ${b.name} (인)` });
  });
  return out;
}
