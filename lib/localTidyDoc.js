// 지자체 자체기준 "서류 정리" (4단계)
// 심사 기준: 4. 지자체 자체 선정기준 (15점) — ⚠️ 관할 시·군·구마다 항목이 다르다.
//   흔한 예) 사업설명회 참여 / 재무회계교육 또는 문서컨설팅 참여 등
// 원장님 지시: "지자체 활동이 다양하므로 지자체 충족내용 자료를 업로드 요청하고,
//              업로드하면 지자체 문서로 따로 정리해서 결과를 보여준다."

export const emptyItem = () => ({
  title: '',      // 충족 항목 이름 (예: 사업설명회 참여)
  when: '',       // 일시
  where: '',      // 주관·장소
  who: '',        // 참석자
  content: '',    // 내용
  proof: '',      // 증빙 자료 (수료증·참석확인서 등)
  imgs: [],       // 증빙 사진·스캔
});

export const emptyTidyData = () => ({
  year: '2026',
  region: '',                 // 관할 지자체 (예: ○○시)
  src: '', files: [], skipped: [],
  items: [],                  // [{title, when, where, who, content, proof, imgs}]
  missing: [],
  analyzed: false,
  intro: '', introFeedback: '',
  feedbackText: '',
  reviseLog: [],
});

export const listOf = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

export const itemHasContent = (x) => !!(x && (x.title || x.content || (x.imgs || []).length));
export const tidyHasContent = (d) => !!(d && (d.src?.trim() || (d.items || []).some(itemHasContent)));
export const tidyDone = (d) => !!(d && (d.items || []).some(itemHasContent));

const DEFAULT_INTRO = (center, region, y) =>
  `열린어린이집 선정 기준의 지자체 자체기준은 관할 지자체가 정하는 항목으로, 지역마다 내용이 다릅니다.\n`
  + `${center}은 ${region || '관할 지자체'}가 정한 자체 선정기준을 확인하고, ${y}년도에 아래와 같이 참여·이수하였습니다.\n`
  + `각 항목의 증빙 자료는 어린이집에 보관하고 있으며, 아래에 함께 정리하였습니다.`;

// ── 전체 문서 ──
// 제목 → 1. 지자체 자체기준 안내 → 2. 우리 원 충족 내용(표) → 3. 항목별 증빙 자료
export function buildLocalTidyDoc(data, basic) {
  const center = basic?.centerName?.trim() || '○○어린이집';
  const y = data.year || '2026';
  const items = (data.items || []).filter(itemHasContent);

  const out = [
    { type: 'title', text: `${center} 지자체 자체기준 충족 내용` },
    { type: 'lead', text: `${y}년도 · ${data.region ? `${data.region} ` : ''}지자체 자체 선정기준 (15점)` },
    { type: 'heading', text: '1. 지자체 자체기준 안내' },
    { type: 'para', text: data.intro || DEFAULT_INTRO(center, data.region, y) },
    { type: 'heading', text: '2. 우리 어린이집 충족 내용' },
  ];

  if (!items.length) {
    out.push({ type: 'note', text: '※ 아직 정리한 내용이 없습니다. 지자체 기준을 충족한 자료를 올려 주세요.' });
    return out;
  }

  out.push({
    type: 'table',
    head: ['구분', '충족 항목', '일시', '주관 · 장소', '참석자', '증빙 자료'],
    widths: ['7%', '25%', '15%', '19%', '14%', '20%'],
    rows: items.map((x, i) => [`${i + 1}`, x.title || '', x.when || '', x.where || '', x.who || '', x.proof || '']),
    leftFirst: true,
  });

  out.push({ type: 'heading', text: '3. 항목별 내용 및 증빙 자료' });
  items.forEach((x, i) => {
    if (i > 0) out.push({ type: 'divider' });
    out.push({ type: 'sessionhead', text: `${i + 1}. ${x.title || '충족 항목'}` });
    out.push({
      type: 'kv',
      rows: [
        ['일 시', x.when || ''],
        ['주관 · 장소', x.where || ''],
        ['참석자', x.who || ''],
        ['증빙 자료', x.proof || ''],
      ].filter(([, v]) => v),
    });
    if (x.content) out.push({ type: 'para', text: x.content });
    const imgs = (x.imgs || []).filter(Boolean);
    if (imgs.length) {
      out.push({ type: 'photos', small: true, items: imgs, caption: `${x.title || ''} 증빙 자료` });
    }
  });
  return out;
}

export function docTextOf(data) {
  return [
    `[안내글]\n${data.intro || '(기본 문구)'}`,
    ...(data.items || []).map((x, i) => `[${i}번 · ${x.title || '무제'}]\n${x.content || '(없음)'}`),
  ].join('\n\n');
}

export function toHwpxBlocks(blocks) {
  const out = [];
  blocks.forEach((b) => {
    if (b.type === 'title') out.push({ kind: 'title', text: b.text });
    else if (b.type === 'lead') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'heading' || b.type === 'sessionhead' || b.type === 'subheading') out.push({ kind: 'head', text: b.text });
    else if (b.type === 'para') out.push({ kind: 'body', text: b.text });
    else if (b.type === 'note') out.push({ kind: 'note', text: b.text });
    else if (b.type === 'kv') (b.rows || []).forEach(([k, v]) => out.push({ kind: 'body', text: `${k} : ${String(v || '').replace(/\n/g, ' / ')}` }));
    else if (b.type === 'table') {
      out.push({ kind: 'body', text: (b.head || []).join(' | ') });
      (b.rows || []).forEach((r) => out.push({ kind: 'body', text: r.join(' | ') }));
    }
    else if (b.type === 'photos') {
      out.push({ kind: 'note', text: `※ 증빙 자료 ${(b.items || []).filter(Boolean).length}장은 PDF 파일에 들어 있습니다.` });
    }
  });
  return out;
}
