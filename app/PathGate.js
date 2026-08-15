'use client';

// 참여성으로 넘어갈 때 나오는 갈림길 화면.
// 서류 단계를 ① 새로 만들기 ② 기존 서류 분석·정리 두 가지로 나눠 고르게 한다.
export default function PathGate({ onNew, onExisting, onHome }) {
  return (
    <div className="wrap">
      <button className="back" onClick={onHome}>← 첫 화면(심사기준)으로</button>

      <div className="gate-hero">
        <div className="gate-tag">2단계 · 참여성부터</div>
        <h1>여기서부터 <b>서류 정리 단계</b>입니다</h1>
        <p>
          개방성은 현장 상태로 확인하는 영역이라 만들 서류가 없었습니다.<br />
          <b>참여성과 다양성은 실제로 서류를 갖춰야 하는 영역</b>이에요.
        </p>
      </div>

      <div className="gate-lead">
        <p>서류 준비는 우리 원 상황에 따라 <b>두 가지 길</b>로 나뉩니다. 아래에서 <b>지금 필요한 쪽을 고르세요.</b></p>
        <p className="gate-lead-sub">※ 둘 다 사용해도 됩니다. 없는 서류는 새로 만들고, 있는 자료는 정리하면 됩니다.</p>
      </div>

      <div className="gate-grid">
        <button className="gate-card new" onClick={onNew}>
          <span className="gate-no">1</span>
          <span className="gate-name">서류를 아예 새로 만들기</span>
          <span className="gate-when">우리 원에 <b>그 서류가 없을 때</b></span>
          <span className="gate-desc">
            지금까지 만들어 둔 서류가 없거나, 형식이 맞지 않아 처음부터 만들어야 할 때 선택하세요.
            먼저 <b>어린이집·교직원·반·원아 기본사항</b>을 등록해 두면, 서류를 만들 때마다 그 내용이 그대로 쓰입니다.
          </span>
          <span className="gate-go">기본사항 등록부터 시작 →</span>
        </button>

        <button className="gate-card keep" onClick={onExisting}>
          <span className="gate-no">2</span>
          <span className="gate-name">기존 서류를 분석·정리하기</span>
          <span className="gate-when">우리 원에 <b>자료가 이미 있을 때</b></span>
          <span className="gate-desc">
            상담자료·공지문·사진·회의 메모처럼 <b>이미 가지고 있는 자료</b>를 넣으면,
            AI가 정리해 심사에 낼 수 있는 문서 형태로 만들어 줍니다.
          </span>
          <span className="gate-go">참여성 서류 목록으로 →</span>
        </button>
      </div>
    </div>
  );
}
