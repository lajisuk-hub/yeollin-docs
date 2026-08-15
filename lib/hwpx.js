'use client';

// 한글(.hwpx) 파일 만들기 — witak-course에서 검증된 방식 그대로 가져옴.
// 빈 틀(public/base.hwpx)의 section0.xml 안 <!--BODY--> 자리에 문단만 채워 넣는다.
//
// 주의(과거 교훈)
//   - mimetype 은 압축하지 않고 맨 앞에 넣어야 한글이 연다
//   - linesegarray 는 새로 넣지 않는다 (한글이 다시 계산한다)
//   - 사진은 넣지 않는다 (그림은 PDF로 저장할 때만 들어감)

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let pid = 900000;
function para(text, style) {
  pid += 1;
  const run = text
    ? `<hp:run charPrIDRef="${style.char}"><hp:t>${esc(text)}</hp:t></hp:run>`
    : `<hp:run charPrIDRef="${style.char}"></hp:run>`;
  return `<hp:p id="${pid}" paraPrIDRef="${style.para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${run}</hp:p>`;
}

// base.hwpx 에 정의된 글자모양·문단모양 번호
const DOC_STYLE = {
  title: { char: 16, para: 25 },
  head: { char: 17, para: 26 },
  body: { char: 15, para: 28 },
  note: { char: 18, para: 27 },
};

let cachedBase = null;

// blocks: [{ kind: 'title' | 'head' | 'body' | 'note', text }]
export async function buildDocHwpx({ blocks, onProgress }) {
  const JSZip = (await import('jszip')).default;
  if (!cachedBase) {
    if (onProgress) onProgress('한글 틀을 불러오는 중입니다...');
    const res = await fetch('/base.hwpx');
    if (!res.ok) throw new Error('한글 틀(base.hwpx)을 찾지 못했습니다');
    cachedBase = await JSZip.loadAsync(await res.arrayBuffer());
  }
  const zip = cachedBase;

  let xml = '';
  blocks.forEach((b) => {
    const style = DOC_STYLE[b.kind] || DOC_STYLE.body;
    String(b.text == null ? '' : b.text)
      .split(/\r?\n/)
      .forEach((line) => { xml += para(line, style); });
  });

  const raw = await zip.file('Contents/section0.xml').async('string');
  const sectionXml = raw.replace('<!--BODY-->', xml);

  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });
  const names = Object.keys(zip.files).filter(
    (n) => n !== 'mimetype' && n !== 'Contents/section0.xml' && !zip.files[n].dir
  );
  for (const n of names) {
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/section0.xml', sectionXml, { compression: 'DEFLATE' });

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
