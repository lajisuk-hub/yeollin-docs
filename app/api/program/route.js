// 부모참여프로그램(열린어린이집의 날) 단계별 작성 도우미
// (연간계획 / 부모 안내문 / 실시기록 / 운영 평가)
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
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 따뜻하고 정중한 존댓말, 공문서다운 담백한 문체로 씁니다. '
  + '큰따옴표(")는 쓰지 않습니다. 알려주지 않은 숫자나 성과는 지어내지 않습니다. '
  + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다.';

const KINDS = {
  // 지금까지 해 온 부모참여프로그램이 없을 때 임의로 추천해 주기
  suggest: {
    system: `${BASE_RULE} 지금 쓸 것은 이 어린이집이 해 봄직한 부모참여프로그램 예시 목록입니다. `
      + '알려준 아이 연령과 희망 참여 대상에 맞추어 6~8가지를 추천합니다. '
      + '한 줄에 하나씩 쓰고, 각 줄은 프로그램 이름 - 한 문장 설명 모양으로 씁니다. 번호는 붙이지 않습니다.',
  },
  // 최종 문서 맨 앞에 들어가는 필요성
  need: {
    system: `${BASE_RULE} 지금 쓸 것은 어린이집 부모참여프로그램의 필요성입니다. `
      + '부모가 어린이집의 놀이와 일과에 직접 참여해 자녀의 생활을 함께 보고, 어린이집 운영을 이해하며 신뢰를 쌓는다는 내용을 담습니다. '
      + '열린어린이집이 지향하는 부모 참여와 소통의 취지, 참여로 얻는 효과(부모·영유아·교직원), '
      + '부모 의견을 보육과정에 반영한다는 점까지 6~8문장으로 씁니다. 알려준 어린이집 연령과 참여 대상이 있으면 자연스럽게 담습니다.',
  },
  // 연간계획 12개월 (월 1회)
  plan: {
    json: true,
    system: '당신은 어린이집 부모참여프로그램 연간계획을 세우는 보육과정 전문가입니다. '
      + '어린이집 학년도(3월 시작)에 맞추어 3월부터 다음 해 2월까지 열두 달, 달마다 1회씩 계획을 세웁니다. '
      + '큰따옴표(")는 쓰지 않습니다.\n'
      + 'months : 열두 개 항목입니다. 순서는 3,4,5,6,7,8,9,10,11,12,1,2월입니다. '
      + '항목마다 {"m":3,"theme":"주제(프로그램명)","target":"대상","method":"운영 방법","content":"주요 내용"} 으로 씁니다.\n'
      + 'theme 은 그 달의 계절·행사와 어울리는 프로그램 이름을 짧게 씁니다(예: 아빠와 함께하는 봄 놀이터). '
      + 'target 은 알려준 희망 참여 대상 중에서 고르되 열두 달에 골고루 나누어 배정합니다(예: 아빠, 엄마, 가족 모두, 조부모). '
      + 'method 는 어디에서 어떻게 하는지 한 구절로 씁니다(예: 어린이집 유희실 · 부모 참여 놀이). '
      + 'content 는 어떤 활동을 하는지 한 문장으로 씁니다.\n'
      + '알려준 아이 연령에 맞는 활동으로 계획하고, 이미 해 온 프로그램을 알려주면 그 흐름을 살립니다. '
      + '3월은 새 학기 적응, 5월은 가정의 달, 12월은 성탄·연말, 2월은 졸업·수료와 어울리게 배치합니다.\n'
      + '아래 JSON 하나만 출력합니다. {"months":[{"m":3,"theme":"…","target":"…","method":"…","content":"…"}]}',
  },
  // 그 달 부모에게 보내는 공지문 (일시·장소·대상·내용은 따로 표시되므로 인사말과 참고사항만)
  notice: {
    json: true,
    system: `${BASE_RULE} 지금 쓸 것은 그 달 부모참여프로그램 공지문(가정통신문)의 인사말과 참고사항입니다. `
      + '일시·장소·대상·활동 내용은 공지문에 항목으로 따로 들어가므로 인사말에 다시 나열하지 않습니다.\n'
      + 'greeting : 그 달 계절 인사로 시작해 이번 프로그램의 취지와 무엇을 함께하는지, 참여를 부탁드리는 말까지 4~6문장. '
      + '한 문장씩 줄바꿈합니다. 부모님께 드리는 따뜻한 말투로 씁니다.\n'
      + 'notes : 참고사항 2~3가지입니다. 준비물, 참여 신청 방법(담임교사에게 알려 주기), 주차·문의 같은 실무 안내를 짧은 문장으로 씁니다. '
      + '일시와 장소는 이미 위에 나오므로 참고사항에서 되풀이하지 않습니다. 문자열 배열로 씁니다.\n'
      + '아래 JSON 하나만 출력합니다. {"greeting":"인사말","notes":["참고사항1","참고사항2"]}',
  },
  // 원장이 적을 메모의 초안 (공지문에 안내한 내용을 그대로 따라 그날 진행 순서를 짜 준다)
  memo: {
    system: `${BASE_RULE} 지금 쓸 것은 원장이 실시기록을 쓰기 위해 적어 두는 메모의 초안입니다. `
      + '앞서 부모님께 보낸 공지문에 안내한 주제·일시·장소·대상 그대로 그날 진행되었다고 보고, '
      + '시작 시각부터 끝 시각까지 진행 순서를 6줄 내외로 적습니다. 한 줄에 하나씩, 시간 다음에 무엇을 했는지 씁니다. '
      + '예) 10:00 부모님과 아이가 함께 등원, 이름표 달기\n'
      + '그다음 빈 줄을 하나 두고, 부모님 반응 한 줄과 아쉬웠던 점·다음에 보완할 점 한 줄을 덧붙입니다. '
      + '이 두 줄은 원장이 고쳐 쓸 예시이므로 흔히 있을 법한 내용으로 담백하게 씁니다. '
      + '참석 인원 같은 숫자는 지어내지 않습니다. 문장은 짧은 메모체로 씁니다.',
  },
  // 실시기록 — 진행 순서 표와 운영 내용 정리
  record: {
    json: true,
    system: '당신은 어린이집 부모참여프로그램(열린어린이집의 날) 실시기록을 정리하는 전문가입니다. '
      + '원장이 적어 준 메모를 아래 서식대로 정리합니다. 메모에 없는 내용은 지어내지 않되, 짧은 메모는 기록다운 문장으로 다듬습니다. '
      + '큰따옴표(")는 쓰지 않습니다.\n'
      + 'flow : 그날의 진행 순서입니다. 항목마다 {"time":"시간","content":"운영 내용"} 으로 씁니다. '
      + 'time 은 09:30 ~ 10:00 처럼 쓰고, 메모에 시간이 없으면 빈 문자열로 둡니다. '
      + '마지막 항목의 끝 시각은 알려준 운영 종료 시각에 맞추고, 시작과 끝 시각을 같게 쓰지 않습니다. '
      + 'content 는 무엇을 어떻게 했는지 한두 문장으로 씁니다. 메모에 있는 순서를 그대로 지킵니다.\n'
      + 'summary : 운영 내용 정리 4~6문장. 어떤 활동을 했고 부모와 영유아가 어떻게 참여했는지, '
      + '부모가 어떤 의견을 주었는지를 담아 개조식이 아닌 서술형으로 씁니다. 알려준 참석 인원이 있으면 문장에 자연스럽게 넣습니다.\n'
      + '문장은 모두 ~하였다, ~였다, ~보였다 처럼 서술체로 맺습니다. ~합니다, ~습니다 같은 존댓말은 쓰지 않습니다.\n'
      + '아래 JSON 하나만 출력합니다. {"flow":[{"time":"…","content":"…"}],"summary":"…"}',
  },
  // 운영 평가 및 개선사항 (실시기록의 '운영 내용 정리'에 이어 붙으므로 같은 서술체로 쓴다)
  review: {
    system: '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
      + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
      + '지금 쓸 것은 이번 부모참여프로그램의 운영 평가와 개선사항입니다. '
      + '무엇이 잘 되었는지, 부모의 의견은 어떠했는지, 다음 프로그램에서 보완할 점은 무엇인지를 4~6문장으로 씁니다. '
      + '마지막에는 수렴한 의견을 어린이집 운영에 어떻게 반영할지 한 문장으로 맺습니다. '
      + '알려주지 않은 성과나 숫자는 만들지 않습니다. '
      + '문장은 모두 ~하였다, ~였다, ~보였다, ~필요하다, ~반영하고자 한다 처럼 서술체로 맺습니다. '
      + '~합니다, ~습니다, ~됩니다 같은 존댓말은 한 문장도 쓰지 않습니다.',
  },
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, month, year, program, when, place, target, attend, memo, notice, ages, past, targets, content, sample, previous, feedback } = await request.json();
    const spec = KINDS[kind];
    if (!spec) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });

    const info = [
      `어린이집: ${center || ''}`,
      year ? `운영 연도: ${year}년 3월 ~ ${Number(year) + 1}년 2월 (어린이집 학년도)` : '',
      ages ? `어린이집 아이 연령: ${ages}` : '',
      targets ? `희망하는 참여 대상: ${targets}` : '',
      past ? `지금까지 해 온 부모참여프로그램:\n${past}` : '',
      month ? `이 달: ${month}` : '',
      program ? `프로그램 주제: ${program}` : '',
      content ? `계획된 주요 내용: ${content}` : '',
      when ? `운영 일시: ${when}` : '',
      place ? `장소: ${place}` : '',
      target ? `대상: ${target}` : '',
      attend ? `참석 현황: ${attend}` : '',
      notice ? `부모님께 보낸 공지문 내용:\n${notice}` : '',
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
