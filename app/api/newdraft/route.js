// '서류 새로 만들기' 전용 AI 초안 (기본사항만으로 문장을 처음부터 작성)
// 기존 서류 분석·정리용 /api/draft 와 분리된 경로.
// 필요한 환경변수: ANTHROPIC_API_KEY
import { getNewDoc } from '../../../lib/newdocs';

export const maxDuration = 60;

// AI가 준 JSON에서 따옴표/줄바꿈 문제를 보정해 파싱 (wmentor-journal 검증 패턴)
function parseAiJson(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 결과를 찾지 못했습니다');
  const text = jsonMatch[0];
  try { return JSON.parse(text); } catch (e) { /* 보정 후 재시도 */ }
  return JSON.parse(repairAiJson(text));
}

function repairAiJson(s) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c;
      continue;
    }
    if (c === '\\') { out += c + (s[i + 1] || ''); i++; continue; }
    if (c === '\n') { out += '\\n'; continue; }
    if (c === '\r') { out += '\\r'; continue; }
    if (c === '\t') { out += '\\t'; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      const n = s[j];
      if (n === ',' || n === '}' || n === ']' || n === ':' || j >= s.length) { inStr = false; out += c; }
      else out += '\\"';
      continue;
    }
    out += c;
  }
  return out;
}

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { docId, values, basic } = await request.json();
    const doc = getNewDoc(docId);
    if (!doc || !doc.ai) {
      return Response.json({ error: '이 문서는 AI 작성 대상이 아닙니다' }, { status: 400 });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 3000,
        thinking: { type: 'disabled' },
        system: doc.ai.system,
        messages: [{ role: 'user', content: doc.ai.user(values || {}, basic || {}) }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || 'AI 서버 오류' }, { status: res.status });
    }

    const text = (data.content || []).map((b) => b.text || '').join('\n');
    const parsed = parseAiJson(text);
    return Response.json({ result: parsed });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
