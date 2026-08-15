// 부모개별상담 운영 결과 문서 조립 (1·2회차 한 문서)
// 화면 미리보기 블록과 한글(hwpx) 문단을 같은 내용에서 만든다.

export const emptyRound = () => ({
  from: '', to: '', method: '대면 상담', place: '어린이집 상담실',
  notice: '', noticeFeedback: '',
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
  return !!(r && (r.from || r.notice || r.apply || r.summary || (r.photos || []).length));
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

  b.push({ type: 'heading', text: `${n}-1. 부모상담 공지문` });
  b.push({ type: 'para', text: r.notice || '' });

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
    else if (b.type === 'photos') out.push({ kind: 'note', text: `※ 상담 사진 ${b.items.filter(Boolean).length}장은 PDF 파일에 들어 있습니다. 한글 문서에는 사진을 직접 붙여 넣어 주세요.` });
    else if (b.type === 'sign') out.push({ kind: 'note', text: `${b.date}    ${b.role} ${b.name} (인)` });
  });
  return out;
}
