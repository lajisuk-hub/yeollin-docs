// 부모 어린이집 참관 서류 작성 도우미 (게시용 안내문 문구 / 상시 운영 계획)
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

// 심사에서 가장 중요하게 보는 조건 — 어떤 답에도 어긋나면 안 된다
const RULE_ALWAYS =
  '부모 어린이집 참관은 열린어린이집 심사의 현장확인 항목입니다. 반드시 지켜야 할 조건이 있습니다. '
  + '참관은 특정 기간·요일·반으로 제한하지 않고 연중 상시로 운영한다고 써야 합니다. '
  + '매월 몇 주만, 특정 기간에만 같은 제한하는 표현은 절대 쓰지 않습니다. '
  + '참관은 활동에 함께 참여하는 것이 아니라 아이들의 평소 모습을 지켜보는 것임을 분명히 합니다. '
  + '신입 원아 적응기간의 부모 동반은 참관과 다른 것이므로 참관 안내에 섞어 쓰지 않습니다.';

const KINDS = {
  // 벽에 붙이는 게시용 안내문의 인사말과 유의사항
  poster: {
    json: true,
    system: `${BASE_RULE} ${RULE_ALWAYS}\n`
      + '지금 쓸 것은 어린이집 현관과 각 반 게시판에 붙일 참관 안내문의 인사말과 유의사항입니다. '
      + '참관 자격·시기·장소·방법은 안내문에 항목으로 따로 들어가므로 인사말에 다시 나열하지 않습니다.\n'
      + 'lead : 부모님께 드리는 인사말 3~4문장. 어린이집이 언제나 열려 있다는 것과, 아이가 어떤 환경에서 어떻게 지내는지 '
      + '직접 오셔서 보실 수 있도록 연중 상시로 참관을 운영한다는 내용을 담습니다. 한 문장씩 줄바꿈합니다. '
      + '벽에 붙는 안내문이므로 짧고 또렷한 문장으로 씁니다.\n'
      + 'cautions : 유의사항 3가지입니다. 참관은 지켜보는 시간이라는 점, 아이들이 놀이에 집중할 수 있도록 조용히 관찰해 달라는 점, '
      + '참관 중 알게 된 다른 아이의 정보는 비밀로 해 달라는 점을 각각 한 문장으로 씁니다. 문자열 배열로 씁니다.\n'
      + '아래 JSON 하나만 출력합니다. {"lead":"인사말","cautions":["유의사항1","유의사항2","유의사항3"]}',
  },
  // 면담 대비 상시 운영 계획의 목적
  policy: {
    system: `${BASE_RULE} ${RULE_ALWAYS}\n`
      + '지금 쓸 것은 참관 상시 운영 계획의 목적입니다. '
      + '부모가 보육환경과 보육내용을 직접 보고 확인할 수 있도록 참관을 연중 상시로 운영한다는 것, '
      + '참관이 어린이집 운영을 투명하게 공개하고 부모의 신뢰를 얻는 기본적인 방법이라는 것, '
      + '특정 기간이나 요일로 제한하지 않고 부모가 원하는 때에 언제든 참관할 수 있게 한다는 것을 담아 '
      + '두 문단, 모두 합쳐 5~7문장으로 씁니다. 문단 사이는 줄바꿈합니다. 정중한 존댓말로 씁니다.',
  },
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, year, who, when, hours, place, how, previous, feedback } = await request.json();
    const spec = KINDS[kind];
    if (!spec) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });

    const info = [
      `어린이집: ${center || ''}`,
      year ? `운영 연도: ${year}년` : '',
      who ? `참관 자격: ${who}` : '',
      when ? `참관 시기: ${when}` : '',
      hours ? `참관 가능 시간: ${hours}` : '',
      place ? `참관 장소: ${place}` : '',
      how ? `참관 방법: ${how}` : '',
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
        max_tokens: 1500,
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
