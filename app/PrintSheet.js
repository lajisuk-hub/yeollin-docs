'use client';

// 인쇄할 때 "모든 쪽" 위아래에 같은 여백을 넣기 위한 틀.
// 브라우저는 표의 머리글(thead)·바닥글(tfoot)을 쪽마다 반복해서 그리므로,
// 빈 머리글·바닥글을 여백 대신 쓴다. (쪽 여백을 0으로 두어야 날짜·주소가 안 찍힘)
export default function PrintSheet({ children }) {
  return (
    <div className="doc-page">
      <table className="doc-sheet">
        <thead><tr><td><div className="doc-sheet-top" /></td></tr></thead>
        <tbody><tr><td>{children}</td></tr></tbody>
        <tfoot><tr><td><div className="doc-sheet-bot" /></td></tr></tfoot>
      </table>
    </div>
  );
}
