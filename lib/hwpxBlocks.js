// 화면 블록(NewBlocks) → 한글(hwpx) 블록 공통 변환기 (2026-09-19)
// PDF는 화면을 그대로 인쇄하니 표·사진·상자가 살아 있는데, 한글은 서류마다 따로 만든 변환기가
// 글줄만 내보내 "PDF와 한글이 너무 다르다"는 지적을 받았다. 운영위원회(committeeDoc)가 이미
// 표·사진·쪽 나눔을 진짜로 넣고 있어 그 방식을 모든 서류가 같이 쓰도록 한 곳에 모았다.
// 생성기(lib/hwpx.js)가 받는 것: title/head/body/note/caption/sign 글줄, image(dataURL), pagebreak,
//   snap(화면 블록을 그림으로 — 표·상자·그래프·서식 그림. PDF와 같은 모양이 된다. 원장님 지시 2026-09-19)
import { normalizeRules } from './committeeDoc';

const txt = (v) => (v == null ? '' : String(v));

export function blocksToHwpx(blocks) {
  const out = [];
  const push = (kind, text) => out.push({ kind, text: txt(text) });
  const images = (items, ratio) => (items || []).filter(Boolean).forEach((src) => out.push({ kind: 'image', src, ratio }));
  // whole — 서식 그림·사진처럼 중간에서 잘리면 안 되는 것 (쪽에 통째로 놓는다). 표·상자는 잘게 나눠 쪽을 넘어가며 이어진다.
  const snap = (block, whole) => out.push({ kind: 'snap', block, whole: !!whole });

  const one = (b) => {
    if (!b || !b.type) return;
    switch (b.type) {
      case 'cover': snap(b, true); return; // 표지도 화면 모양 그대로
      case 'sectionhead':
        out.push({ kind: 'pagebreak' });
        snap(b, true);
        return;
      case 'title': push('title', b.text); return;
      case 'formtitle': push('title', b.text); return;
      case 'heading': case 'subheading': case 'sessionhead':
        push('head', b.text); return;
      case 'centertitle': push('sign', b.text); return;
      case 'greenbar': snap(b, true); return;
      case 'lead': push('note', b.text); return;
      case 'para': push('body', b.text); return;
      case 'note': push('note', b.text); return;
      case 'blank': snap(b, true); return; // 손으로 적는 밑줄 칸
      case 'pagebreak': out.push({ kind: 'pagebreak' }); return;
      case 'divider': push('body', ''); return;
      // 표·상자·그래프·서식 그림은 화면(PDF)과 똑같은 모양의 그림으로 넣는다 (lib/hwpx.js expandSnaps)
      case 'kv': case 'table': case 'checklist': case 'resultnotes': case 'bars':
      case 'noticedoc': case 'minutesdoc': case 'recorddoc': case 'resultdoc':
        snap(b); return;
      case 'poster': case 'notice': case 'apply': case 'pair': case 'attachrow':
        snap(b, true); return;
      case 'rulesdoc':
        normalizeRules(b.text).split('\n').forEach((t, i) => {
          const s = t.trim();
          if (!s) return;
          if (i === 0 && s.length <= 40) push('title', s);
          else push(/^제\s*\d+\s*장|^부\s*칙$/.test(s) ? 'head' : 'body', s);
        });
        return;
      case 'pages': {
        const items = (Array.isArray(b.items) ? b.items : []).filter(Boolean);
        if (!items.length) { push('note', b.emptyText || '첨부된 자료가 없습니다.'); return; }
        // 증빙이 2장 이상이면 화면처럼 좌우로 나란히 (그림으로)
        if (b.large && items.length >= 2) { snap(b, items.length <= 2); return; }
        images(items, b.big ? 0.95 : (b.large ? 0.55 : 0.85));
        // 설명글은 그림 아래에 — 위에 두면 그림만 다음 쪽으로 넘어가 설명글이 홀로 남는다
        if (b.title && !b.big) push('caption', b.title);
        return;
      }
      case 'photos': case 'images': {
        if (!(b.items || []).filter(Boolean).length) return;
        snap(b, (b.items || []).filter(Boolean).length <= 4);
        return;
      }
      case 'sign': snap(b, true); return;
      default:
        if (b.text != null) push('body', b.text);
    }
  };

  (blocks || []).forEach(one);
  return out;
}
