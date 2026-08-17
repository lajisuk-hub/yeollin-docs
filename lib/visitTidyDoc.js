// 부모 어린이집 참관 "기존 서류 정리" (②번 길)
// 원장님이 정한 순서:
//   ① 게시 중인 참관 안내문을 업로드
//   ② 참관 신청서 양식을 업로드
//   ③ 참관을 신청하신 분이 있으면 참관 기록을 작성
//   ④ 관련 사진 업로드
//   ⑤ 문서로 정리하면 끝
//
// ⚠️ 참관은 서류제출이 아니라 '현장확인' 항목이다. 심사에서 보는 것은
//    ①상시 참관 가능 ②부모가 볼 수 있는 곳에 안내문 게시 ③안내문에 참관 자격·시기·방법 포함.
//    그래서 올린 안내문에 세 가지가 들어 있는지 앱 화면에서 점검해 알려준다.
//    (점검표 자체는 문서에 넣지 않는다 — 원장님 지시)

import { dateText, emptyLog, CHECKPOINTS, KEYWORDS } from './visitDoc';

export { dateText, emptyLog, CHECKPOINTS, KEYWORDS } from './visitDoc';

import { toHwpxBlocks as baseHwpx } from './visitDoc';

// 한글(hwpx)에는 그림이 들어가지 않으므로, 올린 서식·사진 자리에 안내 문구를 넣어 둔다
export function toHwpxBlocks(blocks) {
  const out = [];
  blocks.forEach((b) => {
    if (b.type === 'attachrow') {
      (b.cols || []).forEach((c) => {
        const n = (c.items || []).filter(Boolean).length;
        out.push({
          kind: 'note',
          text: n
            ? `※ ${c.title} ${n}장은 PDF 파일에 들어 있습니다. 한글 문서에는 직접 붙여 넣어 주세요.`
            : `※ ${c.title}을(를) 아직 올리지 않으셨습니다.`,
        });
      });
      return;
    }
    if (b.type === 'pages') {
      const n = (b.items || []).filter(Boolean).length;
      out.push({ kind: 'note', text: n ? `※ ${b.title || '올린 서식'} ${n}장은 PDF 파일에 들어 있습니다.` : (b.emptyText || '') });
      return;
    }
    if (b.type === 'photos') {
      out.push({ kind: 'note', text: `※ 참관 사진 ${(b.items || []).filter(Boolean).length}장은 PDF 파일에 들어 있습니다.` });
      return;
    }
    baseHwpx([b]).forEach((x) => out.push(x));
  });
  return out;
}

// 안내문에 들어 있어야 하는 세 가지 (심사 점검 항목)
export const MUSTS = [
  { k: 'who', label: '참관 자격', hint: '누가 참관할 수 있는지 (예: 재원 영유아의 보호자)' },
  { k: 'when', label: '참관 시기', hint: '언제 참관할 수 있는지 — 연중 상시여야 합니다' },
  { k: 'how', label: '참관 방법', hint: '어떻게 신청하고 참관하는지' },
];

export const emptyTidyData = () => ({
  year: '2026',
  // ① 안내문 · ② 신청서 양식 (사진 또는 PDF → 이미지)
  noticeImgs: [], applyImgs: [],
  // 안내문에서 뽑은 글자 (있으면 AI가 점검)
  noticeText: '', noticeFiles: [], applyFiles: [],
  // AI 점검 결과 { who:{ok,found}, when:{...}, how:{...}, advice:'' }
  check: null, checked: false,
  // ③ 참관 기록
  logs: [emptyLog()],
  // ④ 사진
  photos: [],
  // 마무리
  memo: '',
});

export const listOf = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

export const logList = (d) => (d.logs || []).filter((l) => l && (l.date || l.parent || l.content));

export const tidyHasContent = (d) =>
  !!(d && ((d.noticeImgs || []).length || (d.applyImgs || []).length || logList(d).length || (d.photos || []).length));

// 안내문·신청서를 다 올렸으면 완성 (참관 기록은 신청한 분이 있을 때만)
export const tidyDone = (d) => !!((d?.noticeImgs || []).length && (d?.applyImgs || []).length);

// ── 참관 기록 표 ──
export function logBlocks(data, center) {
  const list = logList(data);
  if (!list.length) {
    return [{
      type: 'note',
      text: '※ 해당 기간 중 참관을 신청하신 보호자가 없어 참관 기록은 비어 있습니다. '
        + '참관은 연중 상시로 운영하고 있으며, 신청이 있는 경우 즉시 안내하고 있습니다.',
    }];
  }
  const rows = list.map((l, i) => [
    String(i + 1),
    l.date ? dateText(l.date) : '',
    l.parent || '',
    l.cls || '',
    (l.from || l.to) ? `${l.from || ''} ~ ${l.to || ''}` : '',
    l.content || '',
  ]);
  return [
    {
      type: 'table',
      head: ['번호', '참관일', '참관자', '반', '시간', '참관 내용 및 의견'],
      widths: ['6%', '18%', '12%', '10%', '16%', '38%'],
      rows,
      leftFirst: true,
    },
    { type: 'note', text: '※ 참관 후 참관자의 의견을 함께 기록하여 어린이집 운영 개선 자료로 활용하고 있습니다.' },
  ];
}

// ── 전체 문서 ──
// 제목 → 1. 참관 안내문(게시본) + 2. 신청서 양식 → 3. 참관 기록 → 4. 참관 사진
export function buildVisitTidyDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2026';
  const notice = (data.noticeImgs || []).filter(Boolean);
  const apply = (data.applyImgs || []).filter(Boolean);
  const photos = (data.photos || []).filter(Boolean);

  const out = [
    { type: 'title', text: `${center} 부모 어린이집 참관 운영` },
    { type: 'lead', text: `${y}년도 · 연중 상시 운영` },
    {
      type: 'para',
      text: `${center}은 부모가 어린이집의 보육환경과 보육내용을 직접 보고 확인할 수 있도록 어린이집 참관을 `
        + `연중 상시로 운영하고 있습니다. 참관 안내문은 부모님이 확인하실 수 있는 곳에 상시 게시하고 있으며, `
        + `참관을 원하시는 보호자가 연락을 주시면 기간이나 요일 제한 없이 안내해 드리고 있습니다.`,
    },
    { type: 'heading', text: '1. 참관 안내문 및 신청서 양식' },
    { type: 'note', text: '※ 아래 안내문은 현관과 각 반 게시판 등 보호자가 확인할 수 있는 곳에 상시 게시하고 있으며, 신청서 양식은 사무실에 비치하고 있습니다.' },
  ];

  // 안내문·신청서는 좌우 2단으로 나란히 (세로 공백 최소화)
  out.push({
    type: 'attachrow',
    cols: [
      { title: '어린이집 참관 안내문 (게시본)', items: notice, emptyText: '※ 게시 중인 참관 안내문을 올려 주세요.' },
      { title: '참관 신청서 (양식)', items: apply, emptyText: '※ 참관 신청서 양식을 올려 주세요.' },
    ],
  });

  out.push({ type: 'heading', text: '2. 참관 기록' });
  logBlocks(data, center).forEach((b) => out.push(b));

  if (photos.length) {
    // 안내문·신청서 그림이 커서 사진은 대개 다음 쪽으로 넘어간다.
    // 어차피 새 쪽이라면 작게 줄이지 않고 크게 넣어 증빙으로 잘 보이게 한다.
    out.push({ type: 'heading', text: '3. 참관 사진' });
    out.push({ type: 'photos', items: photos, caption: `${y}년도 ${center} 어린이집 참관 사진` });
  }

  if (String(data.memo || '').trim()) {
    out.push({ type: 'note', text: data.memo });
  }
  return out;
}

// 안내문만 (게시용으로 크게)
export function buildNoticeOnlyDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const notice = (data.noticeImgs || []).filter(Boolean);
  return [
    { type: 'pages', big: true, title: `${center} 어린이집 참관 안내문`, items: notice, emptyText: '※ 게시 중인 참관 안내문을 올려 주세요.' },
  ];
}

// 신청서 양식만 (인쇄해서 비치)
export function buildApplyOnlyDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const apply = (data.applyImgs || []).filter(Boolean);
  return [
    { type: 'pages', big: true, title: `${center} 참관 신청서`, items: apply, emptyText: '※ 참관 신청서 양식을 올려 주세요.' },
  ];
}
