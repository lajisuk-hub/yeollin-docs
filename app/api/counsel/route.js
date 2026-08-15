// 부모개별상담 단계별 작성 도우미 (공지문 / 신청서 안내문 / 상담 결과 정리)
// 순수 글만 돌려준다(JSON 아님) — 원장님이 화면에서 바로 고칠 수 있게.
// 필요한 환경변수: ANTHROPIC_API_KEY

export const maxDuration = 60;

const BASE_RULE =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 따뜻하고 정중한 존댓말, 공문서다운 담백한 문체로 씁니다. ' +
  '큰따옴표(")는 쓰지 않습니다. 확인되지 않은 숫자나 성과는 지어내지 않습니다. ' +
  '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다.';

const KINDS = {
  notice: {
    system: `${BASE_RULE} 지금 쓸 것은 어린이집이 전체 학부모에게 보내는 부모 개별상담 안내문 본문입니다. ` +
      '인사 - 상담의 취지 - 상담 기간과 방법 - 신청 방법 - 협조 부탁 순서로 6~8문장으로 씁니다. 문단은 2~3개로 나눕니다.',
  },
  apply: {
    system: `${BASE_RULE} 지금 쓸 것은 부모가 작성하는 부모 개별상담 신청서의 안내 문구입니다. ` +
      '맨 위에 들어갈 짧은 안내 2~3문장을 쓰고, 줄을 바꿔 상담에서 나누고 싶은 내용의 예시를 4~5개 항목으로 씁니다. ' +
      '각 예시 항목은 줄 앞에 가운뎃점(·)을 붙입니다.',
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
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
