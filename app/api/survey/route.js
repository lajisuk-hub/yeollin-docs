// 부모만족도조사 결과보고서 작성 도우미 (설문 인사말 / 잘된 점 · 개선 의견 · 조치사항)
// 필요한 환경변수: ANTHROPIC_API_KEY

export const maxDuration = 60;

function parseAiJson(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 응답에서 결과를 찾지 못했습니다');
  try { return JSON.parse(m[0]); } catch (e) { /* 보정 후 재시도 */ }
  return JSON.parse(repairAiJson(m[0]));
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

const BASE_RULE =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '알려주지 않은 숫자나 성과는 지어내지 않습니다. 설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다.';

const KINDS = {
  // 설문지 맨 앞 인사말
  intro: {
    system: `${BASE_RULE} 지금 쓸 것은 부모만족도 조사 설문지 맨 앞의 인사말입니다. `
      + '학부모님께 감사 인사를 드리고, 더 나은 보육 서비스를 위해 매년 만족도 조사를 실시한다는 것과 '
      + '응답 내용이 어린이집 운영 자료로 쓰인다는 것, 참여를 부탁드린다는 내용을 4~5문장으로 씁니다. '
      + '정중한 존댓말로 쓰고 무기명 조사임을 밝힙니다.',
  },
  // 결과보고서의 잘된 점 / 개선 의견 / 조치사항
  result: {
    json: true,
    system: `${BASE_RULE} 지금 쓸 것은 부모만족도 조사 결과보고서의 비고란입니다. `
      + '알려준 영역별 평균 점수(5점 만점)를 그대로 근거로 삼아 씁니다. 점수를 바꾸거나 새로 만들지 않습니다.\n'
      + 'good : 잘된 점입니다. 점수가 높은 영역을 짚어 2~3줄로 씁니다. 한 줄에 하나씩 줄바꿈하고, 각 줄은 짧은 개조식으로 씁니다.\n'
      + 'improve : 개선 의견입니다. 점수가 가장 낮은 영역을 짚고, 부모가 냈을 법한 구체적인 건의를 함께 2~4줄로 씁니다. '
      + '원장이 적어 준 부모 의견이 있으면 그 내용을 그대로 살립니다. 한 줄에 하나씩 줄바꿈합니다.\n'
      + 'action : 어린이집이 앞으로 하겠다는 조치사항입니다. 개선 의견 하나하나에 대응하도록 2~4줄로 쓰고, '
      + '각 줄은 ~하겠습니다 로 맺습니다. 한 줄에 하나씩 줄바꿈합니다.\n'
      + '아래 JSON 하나만 출력합니다. {"good":"…","improve":"…","action":"…"}',
  },
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, year, period, counts, scores, best, worst, memo, sample, previous, feedback } = await request.json();
    const spec = KINDS[kind];
    if (!spec) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });

    const info = [
      `어린이집: ${center || ''}`,
      year ? `조사 연도: ${year}년 (연 1회 조사)` : '',
      period ? `조사 기간: ${period}` : '',
      counts ? `조사 규모: ${counts}` : '',
      scores ? `영역별 평균 점수(5점 만점):\n${scores}` : '',
      best ? `가장 높은 영역: ${best}` : '',
      worst ? `가장 낮은 영역: ${worst}` : '',
      memo ? `원장이 적은 부모 의견·특이사항:\n${memo}` : '',
      sample ? `\n[이 어린이집이 쓰던 서식 — 이 틀과 말투를 그대로 따라 주세요]\n${sample}` : '',
    ].filter(Boolean).join('\n');

    const user = previous && feedback
      ? `${info}\n\n[먼저 쓴 글]\n${previous}\n\n[원장이 고쳐 달라고 한 부분]\n${feedback}\n\n위 요청을 반영해 전체를 다시 써 주세요.`
      : info;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        thinking: { type: 'disabled' },
        system: spec.system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || 'AI 서버 오류' }, { status: res.status });
    }
    const text = (data.content || []).map((b) => b.text || '').join('\n').trim();
    if (!text) return Response.json({ error: 'AI가 빈 답을 보냈습니다. 다시 시도해 주세요.' }, { status: 502 });
    if (spec.json) return Response.json({ result: parseAiJson(text) });
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
