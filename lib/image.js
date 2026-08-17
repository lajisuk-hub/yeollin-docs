'use client';

// 업로드 사진을 화면/PDF에 알맞게 줄여서 dataURL로 (용량·속도 안정화)
export function fileToResizedDataURL(file, maxW = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// PDF 파일 → 페이지별 이미지(dataURL) 배열
// ⚠️ intent:'print' 로 그려야 탭을 숨겨도 멈추지 않는다 (paper-translator 교훈)
export async function pdfToImages(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const imgs = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1240 / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
    imgs.push(canvas.toDataURL('image/jpeg', 0.85));
  }
  return imgs;
}

// 사진·PDF를 섞어 올렸을 때 이미지(dataURL) 배열로 모아 준다
export async function filesToImages(fileList) {
  const files = Array.from(fileList || []);
  let urls = [];
  for (const f of files) {
    const isPdf = (f.name || '').toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
    urls = urls.concat(isPdf ? await pdfToImages(f) : [await fileToResizedDataURL(f)]);
  }
  return urls;
}
