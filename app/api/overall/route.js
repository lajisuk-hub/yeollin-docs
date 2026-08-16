// 전체 서류 묶음의 열린어린이집 운영 목표 작성 도우미
// 필요한 환경변수: ANTHROPIC_API_KEY

export const maxDuration = 60;

const BASE_RULE =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '알려주지 않은 숫자나 성과는 지어내지 않습니다. 설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다.';

const KINDS = {
  goal: {
    system: `${BASE_RULE} 지금 쓸 것은 어린이집의 열린어린이집 운영 목표입니다. `
      + '이 글은 열린어린이집 관련 서류를 묶은 자료집의 두 번째 장에 들어갑니다.\n'
      + '첫 문장에서 어린이집의 문을 열어 부모와 지역사회가 함께 아이를 기르는 열린어린이집을 지향한다는 뜻을 밝힙니다.\n'
      + '그다음 첫째, 둘째, 셋째 로 시작하는 세 문장을 씁니다. '
      + '첫째는 개방성(보육실·공용공간 상시 개방, 참관, 온라인 소통창구)으로 운영을 투명하게 공개한다는 내용, '
      + '둘째는 참여성(개별상담·운영위원회·부모참여프로그램·만족도조사)으로 부모 의견을 정기적으로 듣고 반영한다는 내용, '
      + '셋째는 다양성(이웃 어린이집·지역사회 기관 연계)으로 아이들의 경험을 넓힌다는 내용입니다.\n'
      + '마지막 문장은 이 자료가 해당 연도 운영 내용을 영역별로 정리한 것이라고 맺습니다.\n'
      + '문단마다 줄바꿈하고 모두 합쳐 6~7문장으로 씁니다. 정중한 존댓말로 씁니다.',
  },
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, year, docs, previous, feedback } = await request.json();
    const spec = KINDS[kind];
    if (!spec) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });

    const info = [
      `어린이집: ${center || ''}`,
      year ? `운영 연도: ${year}년` : '',
      docs ? `이 자료집에 들어가는 서류: ${docs}` : '',
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
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
