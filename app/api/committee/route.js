// 운영위원회 단계별 작성 도우미 (개최 안내문 / 회의록 / 회의결과 안내문)
// 필요한 환경변수: ANTHROPIC_API_KEY

export const maxDuration = 60;

// AI가 준 JSON에서 따옴표/줄바꿈 문제를 보정해 파싱 (wmentor-journal 검증 패턴)
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
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 따뜻하고 정중한 존댓말, 공문서다운 담백한 문체로 씁니다. ' +
  '큰따옴표(")는 쓰지 않습니다. 알려주지 않은 숫자나 성과는 지어내지 않습니다. ' +
  '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다.';

const KINDS = {
  // 어린이집 운영위원회 회칙 (원장님이 준 서식을 그 해 위원 명단에 맞춰 완성)
  rules: {
    system: `${BASE_RULE} 지금 쓸 것은 어린이집 운영위원회 회칙 전문입니다. ` +
      '원장이 서식을 주면 그 조문 순서와 표현을 최대한 그대로 살리고, 어린이집 이름·연도·위원 구성과 인원만 알려준 내용에 맞게 고쳐 완성합니다. ' +
      '서식을 주지 않으면 영유아보육법 시행령의 어린이집 운영위원회 규정에 맞추어 제1조(목적), 제2조(구성), 제3조(위원의 임기), 제4조(위원장과 부위원장), ' +
      '제5조(기능), 제6조(회의), 제7조(의결), 제8조(회의록 작성과 공개), 제9조(운영 세칙), 부칙 순서로 씁니다. ' +
      '각 조문은 제○조(제목) 으로 시작하고 항이 여럿이면 ① ② ③ 으로 나눕니다. 조문 사이는 빈 줄로 나눕니다. ' +
      '회의는 분기별 1회 정기회의로 하고 회계연도 기준(1분기 3월, 2분기 6~8월, 3분기 9~11월, 4분기 12~2월)임을 회의 조문에 반드시 넣습니다. ' +
      '이미 있는 회칙을 고쳐 달라고 하면, 요청한 부분만 고치고 나머지 조문은 글자 그대로 그대로 둡니다. ' +
      '조문을 새로 넣거나 빼면 그 뒤 조문 번호를 차례대로 다시 매기고, 장 구분과 부칙은 그대로 유지합니다. ' +
      '연도와 어린이집 이름은 알려준 값에 맞춥니다. 설명이나 머리말 없이 회칙 전문만 출력합니다.',
  },
  // 회의 전에 부모에게 보내는 개최 공지문 (일시·장소·안건은 표로 따로 들어가므로 인사말과 맺음말만)
  notice: {
    json: true,
    system: `${BASE_RULE} 지금 쓸 것은 어린이집 운영위원회 개최 공지문의 인사말과 맺음말입니다. ` +
      '일시·장소·안건은 문서에서 표로 따로 보여주므로 인사말과 맺음말에 다시 나열하지 않습니다.\n' +
      'greeting : 학부모님께 드리는 짧은 인사로 시작해, 운영위원회를 여는 취지와 아래 표대로 회의를 연다는 안내까지 3~4문장. 한 문장씩 줄바꿈합니다.\n' +
      'closing : 회의에서 다루었으면 하는 의견이 있으면 어린이집으로 알려 달라는 부탁과, 회의 결과는 안내문으로 공개하겠다는 안내를 2~3문장. 한 문장씩 줄바꿈합니다.\n' +
      '아래 JSON 하나만 출력합니다. {"greeting":"인사말","closing":"맺음말"}',
  },
  // 회의록의 회의순서 + 토의 및 의결사항 (원장님 어린이집 서식 그대로)
  minutes: {
    json: true,
    system:
      '당신은 어린이집 운영위원회 회의록을 정리하는 전문가입니다. 원장이 적어 준 메모를 아래 서식 그대로 정리합니다. ' +
      '메모에 없는 내용은 지어내지 않되, 짧은 메모는 회의록다운 문장으로 다듬습니다. 큰따옴표(")는 쓰지 않습니다.\n' +
      '[회의순서] order — 1. 개회사 로 시작해 안건을 차례로 넣고, 기타 안건, 폐회사 로 맺습니다. 한 줄에 하나씩 번호를 붙입니다. ' +
      '기타 안건 아래에 작은 항목이 여럿이면 그 아래 줄에 1) 2) 3) 으로 들여써서 적습니다.\n' +
      '[토의 및 의결사항] discussion — 반드시 다음 모양을 지킵니다.\n' +
      '  첫 줄은 1. 운영위원회 안건내용 으로 씁니다. (다만 3월에 열리는 1/4분기 회의라면 그 앞에 1. 어린이집 운영위원회 위원 위촉 및 위원장 선정 항목을 먼저 두고, 안건내용을 2. 로 매깁니다.)\n' +
      '  그 아래 안건마다 다음처럼 씁니다.\n' +
      '   1) 안건 이름\n' +
      '       ● 《어린이집》 어린이집이 보고하거나 설명한 내용을 씁니다. 여러 가지면 ① ② ③ 으로 나누고, 결정을 제안하는 것이면 ▶ 를 씁니다.\n' +
      '       ● (운영위원) 위원이 낸 의견을 한두 문장으로 씁니다.\n' +
      '       → (어린이집) 그 의견에 대한 답변을 씁니다.\n' +
      '  안건 번호는 1) 2) 3) 순으로 붙이고, 안건 사이는 빈 줄로 나눕니다. ' +
      '메모에 위원 의견이 없으면 ● (운영위원) 줄과 → 줄은 넣지 않습니다. ' +
      '마지막 안건은 기타 안건 으로 두고 그 아래에 ① ② ③ 을 붙여 《어린이집》 또는 《운영위원》 을 앞에 표시해 적을 수 있습니다.\n' +
      '연도 표기는 알려준 회의 일시와 회계연도에 맞춥니다. 메모에 적힌 연도가 회의 일시와 어긋나면 회의 일시를 기준으로 바로잡습니다.\n' +
      '맺음말은 넣지 않습니다. (문서에서 자동으로 붙습니다.)\n' +
      '아래 JSON 하나만 출력합니다. {"order":"회의순서","discussion":"토의 및 의결사항"}',
  },
  // 회의 후 부모에게 알리는 결과 보고서 (안건별로 표에 들어간다)
  result: {
    json: true,
    system: `${BASE_RULE} 지금 쓸 것은 어린이집 운영위원회 회의결과 안내문이며, 안건별로 표에 들어갑니다.\n` +
      'intro : 회의를 연 날짜와 방식을 한 문장으로 밝힙니다. 예) 2026년 2월 2일(월)에 개최되었으며 대면회의를 진행하였고 결과를 다음과 같이 안내합니다.\n' +
      'items : 안건 목록입니다. 안건마다 {"title":"안건 이름","body":"내용"} 으로 씁니다. body는 다음 모양을 지킵니다.\n' +
      '   ● 《어린이집》 어린이집이 보고·설명한 내용을 개조식으로 씁니다. 여러 가지면 ① ② ③ 으로 줄을 나눕니다.\n' +
      '   ● 《운영위원》 위원이 낸 의견이 있으면 씁니다.\n' +
      '       → 그 의견에 대한 답변을 씁니다.\n' +
      '   줄바꿈은 \\n 으로 넣습니다. 마지막 안건 이름은 기타의견 으로 둘 수 있습니다.\n' +
      'closing : ★ 로 시작하는 감사 인사 3~5문장. 운영위원과 부모님께 감사하는 내용입니다.\n' +
      '문장은 안내문답게 ~함, ~하겠음 처럼 개조식으로 맺습니다. ' +
      '연도 표기는 알려준 회의 일시와 회계연도에 맞춥니다. 메모에 적힌 연도가 회의 일시와 어긋나면 회의 일시를 기준으로 바로잡습니다.\n' +
      '아래 JSON 하나만 출력합니다. {"intro":"…","items":[{"title":"…","body":"…"}],"closing":"★ …"}',
  },
  // 그 분기 운영의 특징 정리 (문서 맨 뒤에 붙는 짧은 총평)
  feature: {
    system: `${BASE_RULE} 지금 쓸 것은 그 분기 운영위원회 운영의 특징을 정리한 짧은 글입니다. ` +
      '이번 분기 회의에서 무엇을 다루었고 그것이 어린이집 운영에 어떤 의미가 있었는지, ' +
      '부모와 지역사회의 의견이 어떻게 반영되었는지를 중심으로 4~6문장으로 씁니다. ' +
      '알려주지 않은 성과나 숫자는 만들지 않습니다.',
  },
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, quarter, when, place, attend, agenda, memo, decisions, sample, previous, feedback } = await request.json();
    const spec = KINDS[kind];
    if (!spec) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });

    const info = [
      `어린이집: ${center || ''}`,
      `분기: ${quarter || ''}`,
      when ? `회의 일시: ${when}` : '',
      place ? `회의 장소: ${place}` : '',
      attend ? `참석자: ${attend}` : '',
      agenda ? `안건:\n${agenda}` : '',
      memo ? `원장이 적은 논의·결정 메모:\n${memo}` : '',
      decisions ? `회의에서 결정된 사항:\n${decisions}` : '',
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
