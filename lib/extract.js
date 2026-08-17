// 원장님이 올린 문서 파일에서 글자만 뽑아낸다.
// 지원: 한글(.hwpx) / 워드(.docx) / PDF(.pdf) / 텍스트(.txt)
//      압축(.zip) — 안에 든 문서들을 하나씩 열어 이어 붙인다 (설문 응답처럼 파일이 많을 때)
// ⚠️ 옛 한글(.hwp, 2007 이전 바이너리)은 읽을 수 없어 안내 문구를 돌려준다.

// 글자를 뽑을 수 있는 파일인지
const DOC_EXT = /\.(hwpx|docx|pdf|txt)$/i;
// 압축 안에 흔히 들어 있지만 글자를 뽑을 수 없는 것들 (스캔 사진·옛 한글·엑셀 등)
const SKIP_EXT = /\.(jpg|jpeg|png|gif|bmp|heic|webp|tif|tiff|hwp|xls|xlsx|ppt|pptx|zip|mp4|mov)$/i;

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}

function tagsToText(xml, closeTag, textTagRe) {
  return xml.split(closeTag).map((p) => {
    const m = [...p.matchAll(textTagRe)].map((x) => decodeXml(x[1].replace(/<[^>]+>/g, '')));
    return m.join('');
  }).filter((s) => s.trim()).join('\n');
}

export async function extractTextFromFile(file) {
  const name = (file.name || '').toLowerCase();

  if (name.endsWith('.txt') || file.type === 'text/plain') return (await file.text()).trim();

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let txt = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const c = await (await pdf.getPage(p)).getTextContent();
      txt += c.items.map((i) => i.str).join(' ') + '\n';
    }
    txt = txt.trim();
    if (!txt) throw new Error('이 PDF는 글자가 아니라 그림으로 되어 있어 내용을 읽을 수 없습니다. 한글 파일(hwpx)로 올려 주세요.');
    return txt;
  }

  if (name.endsWith('.hwp')) {
    throw new Error('옛 한글 파일(.hwp)은 읽을 수 없습니다. 한글에서 [다른 이름으로 저장] → hwpx 또는 PDF로 저장해 올려 주세요.');
  }

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  if (name.endsWith('.hwpx')) {
    const names = Object.keys(zip.files).filter((n) => /Contents\/section\d+\.xml$/i.test(n)).sort();
    let txt = '';
    for (const n of names) txt += tagsToText(await zip.files[n].async('string'), '</hp:p>', /<hp:t>([\s\S]*?)<\/hp:t>/g) + '\n';
    return txt.trim();
  }

  if (name.endsWith('.docx')) {
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('워드 문서를 읽지 못했습니다');
    return tagsToText(await f.async('string'), '</w:p>', /<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  }

  throw new Error('지원하지 않는 파일 형식입니다 (한글 hwpx · 워드 docx · PDF · txt만 가능)');
}

// ── 압축(zip) 파일 안의 문서들을 한꺼번에 읽기 ──
// 설문 응답처럼 파일이 많을 때 하나로 묶어 올릴 수 있게 한다.
// 돌려주는 값: { text, names(읽은 파일), skipped(못 읽은 파일) }
export async function extractTextFromZip(file, onProgress) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const entries = Object.keys(zip.files)
    .filter((n) => !zip.files[n].dir)
    .filter((n) => !n.startsWith('__MACOSX/') && !n.split('/').pop().startsWith('._'))
    .sort((a, b) => a.localeCompare(b, 'ko'));

  const names = [];
  const skipped = [];
  let text = '';

  for (const n of entries) {
    const short = n.split('/').pop();
    if (!DOC_EXT.test(short)) { skipped.push(short); continue; }
    if (onProgress) onProgress(`${short} 읽는 중… (${names.length + 1}/${entries.length})`);
    try {
      const blob = await zip.files[n].async('blob');
      const inner = new File([blob], short);
      const t = await extractTextFromFile(inner);
      if (!t.trim()) { skipped.push(short); continue; }
      text += `${text ? '\n\n' : ''}[${short}]\n${t}`;
      names.push(short);
    } catch {
      skipped.push(short);
    }
  }

  if (!names.length) {
    throw new Error(
      '압축 파일 안에서 글자를 읽을 수 있는 문서를 찾지 못했습니다.\n'
      + '스캔한 사진(jpg·png)이나 옛 한글(.hwp)은 읽을 수 없습니다. 한글(hwpx)·워드(docx)·PDF·텍스트로 저장해 다시 묶어 주세요.',
    );
  }
  return { text, names, skipped };
}

// 파일 하나를 알맞게 읽어 준다 (압축이면 안의 문서들까지)
export async function readAnyFile(file, onProgress) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.zip')) return extractTextFromZip(file, onProgress);
  const text = await extractTextFromFile(file);
  if (!text.trim()) throw new Error(`${file.name}에서 글자를 찾지 못했습니다.`);
  return { text: `[${file.name}]\n${text}`, names: [file.name], skipped: [] };
}

export { SKIP_EXT, DOC_EXT };
