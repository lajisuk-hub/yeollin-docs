import './globals.css';
import AskFab from './AskFab';

export const metadata = {
  title: '열린어린이집 문서 도우미',
  description: '열린어린이집 평가항목별로 필요한 서류(안내문·회의록·기록 등)를 빈칸만 채우면 AI가 완성해 드려요. 각 문서를 PDF로 저장할 수 있습니다.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <AskFab />
      </body>
    </html>
  );
}
