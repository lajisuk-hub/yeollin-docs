'use client';

import { useState } from 'react';
import { AREAS, docsByArea } from '../lib/docs';
import DocForm from './DocForm';

export default function Home() {
  const [selected, setSelected] = useState(null);

  if (selected) {
    return <DocForm doc={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="wrap">
      <header className="hero">
        <h1>열린어린이집 문서 도우미</h1>
        <p>평가항목별로 필요한 서류를 <b>빈칸만 채우면</b> AI가 완성해 드립니다.<br />만든 문서는 <b>각각 PDF로 저장</b>하세요.</p>
      </header>

      <div className="intro">
        <p>📌 열린어린이집은 <b>총 100점 중 80점 이상</b>이면 선정됩니다. 항목마다 <b>정해진 횟수의 증빙 서류</b>가 필요해요. 아래에서 만들 문서를 고르세요.</p>
      </div>

      {AREAS.map((area) => (
        <section key={area.id} className="area">
          <h2 className="area-title" style={{ borderColor: area.color, color: area.color }}>{area.label}</h2>
          <div className="doc-grid">
            {docsByArea(area.id).map((doc) => (
              <button key={doc.id} className="doc-card" onClick={() => setSelected(doc)} style={{ '--accent': area.color }}>
                <span className="doc-card-name">{doc.name}</span>
                <span className="doc-card-freq">{doc.freq}</span>
                <span className="doc-card-desc">{doc.desc}</span>
                <span className="doc-card-go">문서 만들기 →</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <footer className="foot">
        <p>2025 열린어린이집 선정·운영 기준(교육부) 기반 · 만든 서류는 어린이집에서 보관·제출용으로 사용하세요.</p>
      </footer>
    </div>
  );
}
