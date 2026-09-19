// 화면 블록(NewBlocks) → 한글(hwpx) 블록 공통 변환기 (2026-09-19)
// PDF는 화면을 그대로 인쇄하니 표·사진·상자가 살아 있는데, 한글은 서류마다 따로 만든 변환기가
// 글줄만 내보내 "PDF와 한글이 너무 다르다"는 지적을 받았다. 운영위원회(committeeDoc)가 이미
// 표·사진·쪽 나눔을 진짜로 넣고 있어 그 방식을 모든 서류가 같이 쓰도록 한 곳에 모았다.
// 생성기(lib/hwpx.js)가 받는 것: title/head/body/note/caption/sign 글줄, table, image(dataURL), pagebreak
import { normalizeRules } from './committeeDoc';

const txt = (v) => (v == null ? '' : String(v));
const oneLine = (v) => txt(v).replace(/\n+/g, ' / ');
const pct = (w) => (w == null ? undefined : Number(String(w).replace('%', '')) || undefined);
const cellText = (c) => (c === null ? '' : (c && typeof c === 'object' ? txt(c.t) : txt(c)));
const lines = (t) => txt(t).split(/\n+/).map((s) => s.trim()).filter(Boolean);

export function blocksToHwpx(blocks) {
  const out = [];
  const push = (kind, text) => out.push({ kind, text: txt(text) });
  const table = ({ head, rows, widths, labelFirst }) => {
    const rs = (rows || []).map((r) => (Array.isArray(r) ? r.map(cellText) : [cellText(r)]));
    if (!rs.length && !(head || []).length) return;
    const ws = (widths || []).map(pct);
    out.push({ kind: 'table', head: (head || []).map(cellText), rows: rs, widths: ws.every((w) => w) ? ws : undefined, labelFirst: !!labelFirst });
  };
  const kv = (rows) => table({ rows: (rows || []).filter((r) => r && r[1] !== undefined).map(([k, v]) => [k, v]), widths: [22, 78], labelFirst: true });
  const images = (items, ratio) => (items || []).filter(Boolean).forEach((src) => out.push({ kind: 'image', src, ratio }));
  const sign = (center) => { if (center) { push('body', ''); push('sign', center); } };

  const one = (b) => {
    if (!b || !b.type) return;
    switch (b.type) {
      case 'cover':
        push('title', `${b.year ? `${b.year}년 ` : ''}${txt(b.center)}\n열린어린이집 관련 서류`);
        return;
      case 'sectionhead':
        out.push({ kind: 'pagebreak' });
        push('title', `${b.no ? `${b.no}. ` : ''}${txt(b.text)}`);
        if (b.area) push('note', `[${b.area}]`);
        return;
      case 'title': push('title', b.text); return;
      case 'formtitle': push('title', b.text); return;
      case 'greenbar': case 'centertitle': case 'heading': case 'subheading': case 'sessionhead':
        push('head', b.text); return;
      case 'lead': push('note', b.text); return;
      case 'para': push('body', b.text); return;
      case 'note': push('note', b.text); return;
      case 'blank': push('body', Array.from({ length: b.lines || 3 }).map(() => ' ').join('\n')); return;
      case 'pagebreak': out.push({ kind: 'pagebreak' }); return;
      case 'divider': push('body', ''); return;
      case 'kv': kv(b.rows); return;
      case 'table': table(b); return;
      case 'checklist':
        table({ rows: (b.items || []).filter((it) => it && it.value).map((it) => [`□ ${it.label}`, it.value]), widths: [30, 70], labelFirst: true });
        return;
      case 'resultnotes':
        table({ head: ['비고', ''], rows: [
          ['잘된 점', lines(b.good).map((t) => `- ${t.replace(/^[-·▪\s]+/, '')}`).join('\n')],
          ['개선 의견', lines(b.improve).map((t) => `- ${t.replace(/^[-·▪\s]+/, '')}`).join('\n')],
          ['어린이집 조치사항', lines(b.action).map((t) => `▪ ${t.replace(/^[-·▪\s]+/, '')}`).join('\n')],
        ], widths: [22, 78], labelFirst: true });
        if (b.closing) push('body', b.closing);
        return;
      case 'bars': {
        const rows = (b.items || []).filter((it) => it && it.value > 0).map((it) => [it.name, `${Number(it.value).toFixed(1)}점`]);
        if (b.total) rows.push([b.total.name, `${Number(b.total.value || 0).toFixed(1)}점`]);
        table({ head: ['항목', '평균 점수 (5점 만점)'], rows, widths: [60, 40] });
        return;
      }
      case 'rulesdoc':
        normalizeRules(b.text).split('\n').forEach((t, i) => {
          const s = t.trim();
          if (!s) return;
          if (i === 0 && s.length <= 40) push('title', s);
          else push(/^제\s*\d+\s*장|^부\s*칙$/.test(s) ? 'head' : 'body', s);
        });
        return;
      case 'noticedoc':
        push('head', b.title);
        if (b.greeting) push('body', b.greeting);
        kv(b.rows);
        if (b.closing) push('body', b.closing);
        sign(b.center);
        return;
      case 'minutesdoc':
        push('head', b.title);
        kv(b.info);
        table({ head: ['구분', '회 의 내 용'], widths: [22, 78], labelFirst: true,
          rows: [...(b.order ? [['회의순서', b.order]] : []), ['토의 및 의결사항', b.discussion || '']] });
        if (b.closing) push('body', b.closing);
        if ((b.signRows || []).length) table({ head: ['구분', '성명', '서명'], widths: [34, 33, 33], rows: b.signRows });
        return;
      case 'recorddoc':
        push('head', b.title);
        kv(b.info);
        if (!b.noFlow && (b.rows || []).length) table({ head: b.head, rows: b.rows, widths: b.widths });
        (b.sections || []).filter((s) => s && s.text).forEach((s) => { push('head', s.title); push('body', s.text); });
        sign(b.center);
        return;
      case 'resultdoc':
        push('head', b.title);
        if (b.intro) push('body', b.intro);
        if ((b.items || []).length) table({ head: ['안건', '논의·결정 내용'], widths: [28, 72], labelFirst: true,
          rows: b.items.map((it, n) => [`${n + 1}) ${txt(it.title)}`, it.body]) });
        if (b.closing) push('body', b.closing);
        sign(b.center);
        return;
      case 'poster':
        push('head', b.title);
        if (b.lead) push('body', b.lead);
        if ((b.items || []).length) kv(b.items.map((it) => [it.label, oneLine(it.value)]));
        (b.notes || []).forEach((n) => push('note', `※ ${n}`));
        sign(b.center);
        return;
      case 'notice':
        // 서식 그림 위에 글을 얹는 안내문 — 한글에는 그림 대신 글과 표로
        push('head', b.title || `${b.round ? `${b.round} ` : ''}부모 안내문`);
        if (b.greeting) push('body', b.greeting);
        if ((b.items || []).length) kv(b.items.map((it) => [it.label || '안내', oneLine(it.value)]));
        if ((b.questions || []).length) { push('head', '상담 전 생각해 보세요'); b.questions.forEach((q, i) => push('body', `${i + 1}. ${q}`)); }
        (b.notes || []).forEach((n) => push('note', `※ ${n}`));
        sign(b.center);
        return;
      case 'apply':
        push('head', `${b.round ? `${b.round} ` : ''}부모 개별상담 신청서`);
        if (b.intro) push('body', b.intro);
        kv([['반 이름', ''], ['영유아 이름', ''], ['보호자 성함 (관계)', ''], ['연락처', ''],
          ['상담 희망 일시 1지망', '월    일    시    분'], ['상담 희망 일시 2지망', '월    일    시    분'],
          ['상담 방법', '□ 대면    □ 전화'], ...(b.period ? [['상담 기간', b.period]] : [])]);
        if ((b.topics || []).length) { push('head', '나누고 싶은 내용'); b.topics.forEach((t) => push('body', `□ ${t}`)); }
        sign(b.center);
        return;
      case 'pair':
        (b.items || []).forEach((it, i) => { if (b.labels?.[i]) push('head', b.labels[i]); one(it); });
        return;
      case 'attachrow':
        (b.cols || []).forEach((col) => {
          push('head', col.title);
          const items = (Array.isArray(col.items) ? col.items : []).filter(Boolean);
          if (items.length) images(items, 0.7); else push('note', col.emptyText || '미첨부');
        });
        return;
      case 'pages': {
        const items = (Array.isArray(b.items) ? b.items : []).filter(Boolean);
        if (!items.length) { push('note', b.emptyText || '첨부된 자료가 없습니다.'); return; }
        if (b.title) push('head', b.title);
        // 증빙(large)이 2장 이상이면 화면처럼 절반 크기로 (쪽수 절약)
        images(items, b.big ? 0.95 : (b.large ? (items.length >= 2 ? 0.48 : 0.55) : 0.85));
        return;
      }
      case 'photos': case 'images': {
        const items = (b.items || []).filter(Boolean);
        if (!items.length) return;
        if (b.caption) push('head', b.caption);
        images(items, b.small ? 0.5 : 0.62);
        return;
      }
      case 'sign':
        if (b.blank) push('body', `20      년      월      일        ${txt(b.role)} ________________ (인)`);
        else push('body', `${txt(b.date)}    ${txt(b.role)} ${txt(b.name)} (인)`);
        return;
      default:
        if (b.text != null) push('body', b.text);
    }
  };

  (blocks || []).forEach(one);
  return out;
}
