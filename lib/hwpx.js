'use client';

// 한글(.hwpx) 파일 만들기
// 빈 틀(public/base.hwpx)의 section0.xml 안 <!--BODY--> 자리에 내용을 채워 넣는다.
//
// 2026-08-18 확장: 글자만 넣던 것을 → 표 · 사진 · 쪽 나눔까지 넣도록 키웠다.
//   base.hwpx 안에 이미 있는 정의를 그대로 쓴다 (header.xml 은 손대지 않는다)
//     borderFill 3 = 네 변 실선 (표 본문 칸)
//     borderFill 5 = 네 변 실선 + 연보라 배경 (표 머리글 칸)
//     charPr  16 제목(22pt굵게) / 17 소제목(15pt굵게) / 15 본문(12pt) / 18 작은글씨(10pt)
//             8 표머리글(10pt굵게) / 18 표본문(10pt)
//     paraPr  25 가운데 / 26 왼쪽 / 28 본문 / 27 왼쪽작게 / 21·24 가운데(표 칸)
//
// 주의(과거 교훈)
//   - mimetype 은 압축하지 않고 맨 앞에 넣어야 한글이 연다
//   - linesegarray 는 새로 넣지 않는다 (한글이 다시 계산한다)
//   - 폴더 항목(Contents/ 등)은 빼야 한다 (한글이 포장에 엄격함)
//   - 사진을 넣으면 BinData/ 에 파일을 넣고 content.hpf 목록에도 등록해야 한다

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let seq = 900000;
const nid = () => (seq += 1);

// ── 쪽 크기 (base.hwpx = A4 세로) ──
// ⚠️ section0.xml 의 <hp:margin left="2834">를 그대로 믿으면 안 된다.
//    한글이 실제로 잡는 좌우 여백은 30mm(8504)라서, 2834로 계산하면 표가
//    오른쪽으로 삐져나가 마지막 칸이 잘린다. (한글로 열어 PDF로 뽑아 실측한 값)
const PAGE_W = 59528; // A4 너비
const SIDE = 8504; // 실측한 좌·우 여백
const TBL_OUT = 282; // 표 바깥 여백 (outMargin 141 × 2)
const BODY_W = PAGE_W - SIDE * 2 - TBL_OUT; // 42238

// 글자모양·문단모양 번호
// 본문 글씨는 10pt (원장님 요청, 2026-08-18)
const DOC_STYLE = {
  title: { char: 16, para: 25 }, // 22pt 굵게 · 가운데
  head: { char: 17, para: 26 }, // 15pt 굵게 · 왼쪽
  body: { char: 18, para: 28 }, // 10pt 휴먼명조
  note: { char: 2, para: 27 }, // 9pt · 안내 문구
  caption: { char: 2, para: 25 },
  sign: { char: 15, para: 25 }, // 어린이집 이름 (12pt 가운데)
};
// 표 칸은 문단 위아래 여백이 0인 모양(21·11)을 써야 칸 안이 벌어지지 않는다
const CELL_HEAD = { char: 8, para: 21, fill: 5 }; // 굵게 · 가운데 · 연보라
const CELL_BODY = { char: 18, para: 11, fill: 3 }; // 보통 · 왼쪽 · 흰색
const CELL_LABEL = { char: 8, para: 21, fill: 5 }; // 표 왼쪽 이름칸

// 한 문단
function para(text, style, opts = {}) {
  const brk = opts.pageBreak ? '1' : '0';
  const run = text
    ? `<hp:run charPrIDRef="${style.char}"><hp:t>${esc(text)}</hp:t></hp:run>`
    : `<hp:run charPrIDRef="${style.char}"></hp:run>`;
  return `<hp:p id="${nid()}" paraPrIDRef="${style.para}" styleIDRef="0" pageBreak="${brk}" columnBreak="0" merged="0">${run}</hp:p>`;
}

// 표 한 칸 — 줄바꿈이 있으면 문단을 여러 개 넣는다
function cell(text, col, row, w, style) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const inner = lines
    .map(
      (t) =>
        `<hp:p id="${nid()}" paraPrIDRef="${style.para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        (t
          ? `<hp:run charPrIDRef="${style.char}"><hp:t>${esc(t)}</hp:t></hp:run>`
          : `<hp:run charPrIDRef="${style.char}"></hp:run>`) +
        `</hp:p>`
    )
    .join('');
  return (
    `<hp:tc name="" header="${style === CELL_HEAD ? '1' : '0'}" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="${style.fill}">` +
    `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${inner}</hp:subList>` +
    `<hp:cellAddr colAddr="${col}" rowAddr="${row}"/><hp:cellSpan colSpan="1" rowSpan="1"/>` +
    `<hp:cellSz width="${w}" height="282"/>` +
    `<hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`
  );
}

// 칸 너비 정하기 (비율 → HWPUNIT, 합이 정확히 BODY_W 가 되게)
// ratios 는 숫자([1,3])도 되고 화면에서 쓰는 '12%' 같은 글자도 된다
function colWidths(n, ratios) {
  const r =
    ratios && ratios.length === n
      ? ratios.map((x) => {
          const v = parseFloat(String(x));
          return Number.isFinite(v) && v > 0 ? v : 1;
        })
      : Array(n).fill(1);
  const sum = r.reduce((a, b) => a + b, 0) || 1;
  const w = r.map((x) => Math.round((BODY_W * x) / sum));
  w[n - 1] = BODY_W - w.slice(0, n - 1).reduce((a, b) => a + b, 0);
  return w;
}

// 표 — { head:[...], rows:[[...]], widths:[...], labelFirst:true }
function tablePara(t) {
  const rowsIn = (t.rows || []).map((r) => (Array.isArray(r) ? r : [r]));
  const nCol = Math.max(
    (t.head || []).length,
    rowsIn.reduce((a, r) => Math.max(a, r.length), 0),
    1
  );
  const w = colWidths(nCol, t.widths);
  const trs = [];
  let r = 0;
  if (t.head && t.head.length) {
    trs.push(
      `<hp:tr>${t.head
        .concat(Array(Math.max(0, nCol - t.head.length)).fill(''))
        .map((c, i) => cell(c, i, r, w[i], CELL_HEAD))
        .join('')}</hp:tr>`
    );
    r += 1;
  }
  rowsIn.forEach((row) => {
    const cells = row.concat(Array(Math.max(0, nCol - row.length)).fill(''));
    trs.push(
      `<hp:tr>${cells
        .map((c, i) =>
          cell(c, i, r, w[i], t.labelFirst && i === 0 ? CELL_LABEL : CELL_BODY)
        )
        .join('')}</hp:tr>`
    );
    r += 1;
  });
  const R = trs.length;
  const tbl =
    `<hp:tbl id="${nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${R}" colCnt="${nCol}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">` +
    `<hp:sz width="${BODY_W}" widthRelTo="ABSOLUTE" height="${R * 900}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="141" right="141" top="141" bottom="141"/>` +
    `<hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
    trs.join('') +
    `</hp:tbl>`;
  return (
    `<hp:p id="${nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="15">${tbl}</hp:run></hp:p>`
  );
}

// 사진 한 장 (글자처럼 다루기 → 본문 흐름에 같이 흘러간다)
function picPara(itemId, orgW, orgH, curW, curH) {
  const sx = (curW / orgW).toFixed(6);
  const sy = (curH / orgH).toFixed(6);
  const pic =
    `<hp:pic id="${nid()}" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${nid()}" reverse="0">` +
    `<hp:offset x="0" y="0"/><hp:orgSz width="${orgW}" height="${orgH}"/><hp:curSz width="${curW}" height="${curH}"/>` +
    `<hp:flip horizontal="0" vertical="0"/>` +
    `<hp:rotationInfo angle="0" centerX="${Math.round(curW / 2)}" centerY="${Math.round(curH / 2)}" rotateimage="1"/>` +
    `<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:scaMatrix e1="${sx}" e2="0" e3="0" e4="0" e5="${sy}" e6="0"/>` +
    `<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>` +
    `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${orgW}" y="0"/><hc:pt2 x="${orgW}" y="${orgH}"/><hc:pt3 x="0" y="${orgH}"/></hp:imgRect>` +
    `<hp:imgClip left="0" right="${orgW}" top="0" bottom="${orgH}"/>` +
    `<hp:inMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hc:img binaryItemIDRef="${itemId}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
    `<hp:effects/>` +
    `<hp:sz width="${curW}" widthRelTo="ABSOLUTE" height="${curH}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:shapeComment></hp:shapeComment></hp:pic>`;
  return (
    `<hp:p id="${nid()}" paraPrIDRef="25" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="15">${pic}</hp:run></hp:p>`
  );
}

// dataURL → { bytes, ext, mime }
function decodeDataUrl(src) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(src || ''));
  if (!m) return null;
  const mime = m[1];
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : 'jpg';
  let bytes;
  if (m[2]) {
    const bin = atob(m[3]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
  }
  return { bytes, ext, mime };
}

// 사진의 원래 픽셀 크기 재기
function measure(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const PX = 48; // 1픽셀 = 48 HWPUNIT (150dpi 기준, 한글이 쓰는 값)

let cachedBase = null;

/**
 * blocks 한 개는 다음 중 하나
 *   { kind:'title'|'head'|'body'|'note'|'caption', text }
 *   { kind:'pagebreak' }                       → 다음 내용부터 새 쪽
 *   { kind:'table', head:[], rows:[[]], widths:[], labelFirst:bool }
 *   { kind:'image', src:dataURL, ratio:0~1 }   → ratio 는 본문 너비 대비 크기(기본 0.6)
 */
export async function buildDocHwpx({ blocks, onProgress }) {
  const JSZip = (await import('jszip')).default;
  if (!cachedBase) {
    if (onProgress) onProgress('한글 틀을 불러오는 중입니다...');
    const res = await fetch('/base.hwpx');
    if (!res.ok) throw new Error('한글 틀(base.hwpx)을 찾지 못했습니다');
    cachedBase = await JSZip.loadAsync(await res.arrayBuffer());
  }
  const zip = cachedBase;

  // ── 사진 먼저 준비 (크기를 재야 해서 비동기) ──
  const pics = [];
  const imageBlocks = (blocks || []).filter((b) => b && b.kind === 'image' && b.src);
  if (imageBlocks.length && onProgress) onProgress(`사진 ${imageBlocks.length}장을 넣는 중입니다...`);
  for (const b of imageBlocks) {
    const data = decodeDataUrl(b.src);
    if (!data) { pics.push(null); continue; }
    const size = await measure(b.src);
    if (!size) { pics.push(null); continue; }
    const id = `image${pics.length + 1}`;
    const orgW = Math.max(1, Math.round(size.w * PX));
    const orgH = Math.max(1, Math.round(size.h * PX));
    const want = Math.round(BODY_W * (b.ratio || 0.6));
    const curW = Math.min(orgW, want);
    const curH = Math.max(1, Math.round((orgH * curW) / orgW));
    pics.push({ id, data, orgW, orgH, curW, curH });
  }

  // ── 본문 XML 만들기 ──
  let xml = '';
  let pendingBreak = false;
  let picIdx = 0;
  (blocks || []).forEach((b) => {
    if (!b) return;
    if (b.kind === 'pagebreak') { pendingBreak = true; return; }

    if (b.kind === 'table') {
      if (pendingBreak) { xml += para('', DOC_STYLE.body, { pageBreak: true }); pendingBreak = false; }
      xml += tablePara(b);
      xml += para('', DOC_STYLE.body);
      return;
    }

    if (b.kind === 'image') {
      const p = pics[picIdx];
      picIdx += 1;
      if (!p) return;
      if (pendingBreak) { xml += para('', DOC_STYLE.body, { pageBreak: true }); pendingBreak = false; }
      xml += picPara(p.id, p.orgW, p.orgH, p.curW, p.curH);
      return;
    }

    const style = DOC_STYLE[b.kind] || DOC_STYLE.body;
    const lines = String(b.text == null ? '' : b.text).split(/\r?\n/);
    lines.forEach((line, i) => {
      const first = i === 0 && pendingBreak;
      xml += para(line, style, { pageBreak: first });
      if (first) pendingBreak = false;
    });
  });

  const raw = await zip.file('Contents/section0.xml').async('string');
  const sectionXml = raw.replace('<!--BODY-->', xml);

  // ── 사진을 쓴 경우 content.hpf 목록에 등록 ──
  let hpf = await zip.file('Contents/content.hpf').async('string');
  const used = pics.filter(Boolean);
  if (used.length) {
    const items = used
      .map((p) => `<opf:item id="${p.id}" href="BinData/${p.id}.${p.data.ext}" media-type="${p.data.mime}" isEmbeded="1"/>`)
      .join('');
    hpf = hpf.replace('</opf:manifest>', `${items}</opf:manifest>`);
  }

  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });
  const skip = new Set(['mimetype', 'Contents/section0.xml', 'Contents/content.hpf']);
  const names = Object.keys(zip.files).filter((n) => !skip.has(n) && !zip.files[n].dir);
  for (const n of names) {
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/content.hpf', hpf, { compression: 'DEFLATE' });
  out.file('Contents/section0.xml', sectionXml, { compression: 'DEFLATE' });
  used.forEach((p) => {
    out.file(`BinData/${p.id}.${p.data.ext}`, p.data.bytes, { compression: 'DEFLATE' });
  });

  // 한글은 포장에 엄격하다 — JSZip이 자동으로 넣는 폴더 항목(Contents/ 등)을 뺀다
  Object.keys(out.files).forEach((n) => { if (out.files[n].dir) delete out.files[n]; });

  return out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
