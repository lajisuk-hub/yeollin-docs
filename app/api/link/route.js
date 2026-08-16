// 연계·협력 활동 서류 작성 도우미 (필요성 / 연간계획 / 안내문 / 실시기록 / 평가)
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
  + '알려주지 않은 숫자나 성과는 지어내지 않습니다. 설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다.';

const RULE_INFO =
  '이 서류는 열린어린이집 심사의 다양성 영역 자료입니다. '
  + '어린이집 간 연계·협력(10점, 연 2회 이상)과 부모참여활동 지역사회 연계(5점, 연 2회 이상)가 있고, '
  + '지역사회 연계는 부모가 함께 참여한 활동만 인정됩니다.';

const KINDS = {
  need: {
    system: `${BASE_RULE} ${RULE_INFO} 지금 쓸 것은 연계·협력 활동의 필요성입니다. `
      + '어린이집이 지역사회 안에서 함께 자라는 기관이라는 관점에서, 이웃 어린이집과 프로그램·자원을 나누는 일이 아이와 교직원에게 어떤 도움이 되는지, '
      + '지역사회 기관과 연계한 활동에 부모가 함께 참여하는 일이 왜 중요한지를 씁니다. '
      + '연간 계획을 세워 정기적으로 실시하고 결과를 기록으로 남긴다는 내용으로 맺습니다. '
      + '세 문단, 모두 합쳐 7~9문장으로 쓰고 문단 사이는 줄바꿈합니다. 정중한 존댓말로 씁니다.',
  },
  // 연간계획 (활동 건수만큼)
  plan: {
    json: true,
    system: '당신은 어린이집 연계·협력 활동 연간계획을 세우는 보육과정 전문가입니다. '
      + `${RULE_INFO} 큰따옴표(")는 쓰지 않습니다.\n`
      + 'acts : 알려준 횟수만큼의 활동 계획입니다. 항목마다 '
      + '{"i":0,"month":"2026년 5월","title":"활동명","partner":"연계 대상","types":["center"],"content":"주요 내용 한 문장"} 으로 씁니다.\n'
      + 'i 는 0부터 차례로 매깁니다. types 는 center(어린이집 간 연계·협력) 또는 local(지역사회 연계) 중에서 고르며, '
      + '한 활동이 두 요건을 모두 갖추면 둘 다 넣습니다. '
      + '어린이집 간 연계와 지역사회 연계가 각각 최소 두 번씩은 되도록 배정합니다. '
      + 'local 을 넣은 활동은 반드시 부모가 함께 참여하는 활동으로 계획합니다.\n'
      + 'partner 는 알려준 연계 대상 중에서 고르고, title 은 그 기관과 어울리는 활동 이름을 짧게 씁니다. '
      + 'month 는 계절과 어울리게 열두 달에 고루 나눕니다.\n'
      + '아래 JSON 하나만 출력합니다. {"acts":[{"i":0,"month":"…","title":"…","partner":"…","types":["center"],"content":"…"}]}',
  },
  notice: {
    json: true,
    system: `${BASE_RULE} 지금 쓸 것은 연계·협력 활동 안내문(가정통신문)의 인사말과 참고사항입니다. `
      + '활동명·연계 대상·일시·장소·대상은 문서에서 표로 따로 보여주므로 인사말에 다시 나열하지 않습니다.\n'
      + 'greeting : 계절 인사로 시작해 어떤 기관과 무엇을 함께하는지, 아이와 부모가 어떤 경험을 하게 되는지, 참여를 부탁드리는 말까지 4~5문장. '
      + '한 문장씩 줄바꿈합니다.\n'
      + 'notes : 참고사항 2~3가지입니다. 준비물, 참여 신청 방법, 이동 방법이나 안전 안내처럼 실무적인 내용을 짧게 씁니다. 문자열 배열로 씁니다.\n'
      + '아래 JSON 하나만 출력합니다. {"greeting":"인사말","notes":["참고사항1","참고사항2"]}',
  },
  record: {
    json: true,
    system: '당신은 어린이집 연계·협력 활동 실시기록을 정리하는 전문가입니다. '
      + '원장이 적어 준 메모를 아래 서식대로 정리합니다. 메모에 없는 내용은 지어내지 않되, 짧은 메모는 기록다운 문장으로 다듬습니다. '
      + '큰따옴표(")는 쓰지 않습니다.\n'
      + 'flow : 그날의 진행 순서입니다. 항목마다 {"time":"시간","content":"활동 내용"} 으로 씁니다. '
      + 'time 은 10:00 ~ 10:30 처럼 쓰고, 메모에 시간이 없으면 빈 문자열로 둡니다. '
      + '마지막 항목의 끝 시각은 알려준 종료 시각에 맞추고 시작과 끝을 같게 쓰지 않습니다.\n'
      + 'summary : 활동 진행내용 4~6문장. 어느 기관과 어떻게 연계했고 아이와 부모가 어떻게 참여했는지를 서술형으로 씁니다. '
      + '알려준 참석 인원이 있으면 문장에 자연스럽게 넣습니다. '
      + '문장은 모두 ~하였다, ~였다, ~보였다 처럼 서술체로 맺습니다. ~합니다, ~습니다 같은 존댓말은 쓰지 않습니다.\n'
      + '아래 JSON 하나만 출력합니다. {"flow":[{"time":"…","content":"…"}],"summary":"…"}',
  },
  review: {
    system: '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
      + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
      + '지금 쓸 것은 이번 연계·협력 활동의 평가입니다. '
      + '연계가 어떤 점에서 의미가 있었는지, 아이와 부모의 반응은 어떠했는지, 다음에 이어 갈 점이나 보완할 점은 무엇인지를 4~6문장으로 씁니다. '
      + '문장은 모두 ~하였다, ~였다, ~필요하다 처럼 서술체로 맺습니다. ~합니다, ~습니다 같은 존댓말은 쓰지 않습니다. '
      + '알려주지 않은 성과나 숫자는 만들지 않습니다.',
  },
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, year, count, partners, title, partner, types, when, place, target, attend, memo, sample, previous, feedback } = await request.json();
    const spec = KINDS[kind];
    if (!spec) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });

    const info = [
      `어린이집: ${center || ''}`,
      year ? `운영 연도: ${year}년` : '',
      count ? `계획할 활동 횟수: ${count}회` : '',
      partners ? `연계할 수 있는 곳: ${partners}` : '',
      title ? `활동명: ${title}` : '',
      partner ? `연계 대상: ${partner}` : '',
      types ? `인정 항목: ${types}` : '',
      when ? `운영 일시: ${when}` : '',
      place ? `장소: ${place}` : '',
      target ? `대상: ${target}` : '',
      attend ? `참석 현황: ${attend}` : '',
      memo ? `원장이 적은 진행·소감 메모:\n${memo}` : '',
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
