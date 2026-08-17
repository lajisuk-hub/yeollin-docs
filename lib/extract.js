// 원장님이 올린 문서 파일에서 글자만 뽑아낸다.
// 지원: 한글(.hwpx) / 워드(.docx) / PDF(.pdf) / 텍스트(.txt)
// ⚠️ 옛 한글(.hwp, 2007 이전 바이너리)은 읽을 수 없어 안내 문구를 돌려준다.

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
