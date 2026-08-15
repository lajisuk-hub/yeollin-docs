// 부모개별상담 단계별 작성 도우미 (공지문 / 신청서 안내문 / 상담 결과 정리)
// 순수 글만 돌려준다(JSON 아님) — 원장님이 화면에서 바로 고칠 수 있게.
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
  '큰따옴표(")는 쓰지 않습니다. 확인되지 않은 숫자나 성과는 지어내지 않습니다. ' +
  '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다.';

const KINDS = {
  // 안내문(포스터)에 들어갈 조각들 — JSON으로 받는다
  notice: {
    json: true,
    system:
      '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 어린이집이 학부모에게 나눠주는 부모 개별상담 안내문(가정통신문)의 문구를 씁니다. ' +
      '따뜻하고 정중한 존댓말, 짧고 읽기 쉬운 문장으로 씁니다. 큰따옴표(")는 쓰지 않습니다. 확인되지 않은 숫자는 지어내지 않습니다. ' +
      '아래 JSON 하나만 출력합니다. ' +
      'eyebrow는 안내문 맨 위에 들어갈 짧은 문구 한 줄(예: 함께 이야기하고, 함께 성장합니다). ' +
      'greeting은 인사말 3~4문장(한 문장씩 줄바꿈, 이번 상담에서 무엇을 나눌지 포함). ' +
      'questions는 부모가 상담 전에 생각해 오면 좋은 질문 4개(각 1~2문장, 물음표로 끝나게). ' +
      'notes는 부모가 지켜주면 좋은 당부 2개(각 1문장)인데 상담 기간·방법·장소는 이미 표시되므로 반복하지 않습니다. ' +
      '{"eyebrow":"짧은 문구","greeting":"인사말","questions":["질문1","질문2","질문3","질문4"],"notes":["당부1","당부2"]}',
  },
  apply: {
    json: true,
    system:
      '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 부모가 작성해 제출하는 부모 개별상담 신청서의 문구를 씁니다. ' +
      '따뜻하고 정중한 존댓말, 짧고 읽기 쉬운 문장으로 씁니다. 큰따옴표(")는 쓰지 않습니다. ' +
      '아래 JSON 하나만 출력합니다. intro는 신청서 맨 위 안내 2~3문장(작성해서 담임교사에게 제출해 달라는 내용 포함, 한 문장씩 줄바꿈). ' +
      'topics는 부모가 상담에서 나누고 싶은 내용을 고를 수 있게 만든 항목 5개(각 15자 내외의 짧은 구, 물음표나 마침표 없이). ' +
      '{"intro":"안내 문구","topics":["항목1","항목2","항목3","항목4","항목5"]}',
  },
  summary: {
    system: `${BASE_RULE} 지금 쓸 것은 실제로 실시한 부모 개별상담의 결과 정리입니다. ` +
      '원장이 알려준 참여 인원과 기억에 남는 상담 내용을 바탕으로, 참여 규모를 한 문장으로 밝히고 ' +
      '이어서 상담에서 주로 나온 이야기를 3~4개 주제로 묶어 정리합니다. 각 주제는 줄 앞에 가운뎃점(·)을 붙이고 주제 이름 뒤에 설명을 답니다. ' +
      '마지막에 어린이집이 이를 보육에 어떻게 반영할지 2~3문장으로 덧붙입니다. 알려주지 않은 숫자는 만들지 않습니다.',
  },
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, classes, round, period, method, place, count, memo, previous, feedback } = await request.json();
    const spec = KINDS[kind];
    if (!spec) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });

    const info = [
      `어린이집: ${center || ''}`,
      classes ? `반 구성: ${classes}` : '',
      `상담 회차: ${round || ''}`,
      period ? `상담 시기: ${period}` : '',
      method ? `상담 방법: ${method}` : '',
      place ? `상담 장소: ${place}` : '',
      count ? `상담에 참여한 인원: ${count}` : '',
      memo ? `원장이 기억하는 상담 내용: ${memo}` : '',
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
