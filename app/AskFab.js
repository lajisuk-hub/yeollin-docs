'use client';

// 어느 화면에서든 오른쪽 아래에 떠 있는 "문의하기" 단추 (2026-08-19 추가)
// 문서를 만들다 막혔을 때 바로 카카오톡으로 물어볼 수 있게 한다.
// 카톡 주소는 강의실 관리자 화면(yeollin-class /admin)에서 정한 값을 가져오고,
// 못 가져오면 아래 기본 주소를 쓴다. (두 곳을 따로 고칠 필요가 없게)

import { useEffect, useState } from 'react';

const FALLBACK_KAKAO = 'https://open.kakao.com/o/ssrfqHRg';
const FALLBACK_NOTE = '문서를 만들다 궁금한 점이 있으면 카카오톡으로 편하게 물어보세요.\n확인하는 대로 답을 드립니다.';

// 공개해도 되는 값(브라우저에서 읽기 전용으로만 쓰이는 키)
const STORE = 'https://mrkkbrgcalribhfrtqlm.supabase.co';
const STORE_KEY = 'sb_publishable_7bRBKq7N8RkFn6QQkJCNfw_VK1cEIYK';

export default function AskFab() {
  const [open, setOpen] = useState(false);
  const [kakao, setKakao] = useState(FALLBACK_KAKAO);
  const [note, setNote] = useState(FALLBACK_NOTE);

  useEffect(() => {
    let alive = true;
    fetch(`${STORE}/rest/v1/yeollin_site?select=kakao_url,kakao_note&id=eq.1`, {
      headers: { apikey: STORE_KEY, Authorization: `Bearer ${STORE_KEY}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!alive) return;
        const s = Array.isArray(rows) ? rows[0] : null;
        if (s?.kakao_url?.trim()) setKakao(s.kakao_url.trim());
        if (s?.kakao_note?.trim()) setNote(s.kakao_note.trim());
      })
      .catch(() => { /* 인터넷이 잠깐 안 되면 기본 주소를 쓴다 */ });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <button type="button" className="ask-fab" onClick={() => setOpen(true)} aria-label="카카오톡으로 문의하기">
        💬 문의하기
      </button>

      {open && (
        <div className="ask-back" onClick={() => setOpen(false)}>
          <div className="ask-pop" onClick={(e) => e.stopPropagation()}>
            <h3>무엇을 도와드릴까요?</h3>
            <p>{note}</p>
            <a className="ask-kakao" href={kakao} target="_blank" rel="noreferrer">
              💬 카카오톡으로 문의하기
            </a>
            <button type="button" className="ask-close" onClick={() => setOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
}
