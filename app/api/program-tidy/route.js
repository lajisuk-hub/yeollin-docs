// 부모참여프로그램 "기존 서류 정리" — 원장님이 올린 연간계획·실시기록에서 뽑은 글자를
// 우리 문서 서식의 항목으로 나누어 돌려준다. (새로 지어내는 것이 아니라 정리하는 것)
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

// 정리하는 일에 공통으로 붙는 규칙
const TIDY_RULE =
  '당신은 어린이집 부모참여프로그램(열린어린이집의 날) 서류를 정리하는 보육행정 전문가입니다. '
  + '원장이 이미 만들어 둔 문서에서 글자를 뽑아 넘겨 줍니다. 당신이 할 일은 그 내용을 우리 서식의 항목으로 나누어 담는 것입니다.\n'
  + '가장 중요한 규칙: **자료에 있는 내용을 옮겨 담는 것이 우선이고, 없는 사실·숫자·이름·날짜는 절대 지어내지 않습니다.** '
  + '자료에 없으면 그 항목은 빈 문자열("")로 두고 missing 목록에 무엇이 없었는지 적습니다. '
  + '파일에서 글자를 뽑는 과정에서 줄바꿈이나 띄어쓰기가 깨져 있을 수 있으니 문장을 알아보고 자연스럽게 다시 정리합니다. '
  + '큰따옴표(")는 쓰지 않습니다.';

// ① 연간 운영계획 분석
const PLAN_SYSTEM = `${TIDY_RULE}\n`
  + '지금 볼 자료는 어린이집이 세워 둔 부모참여프로그램 연간 운영계획입니다. 이것을 표로 정리합니다.\n'
  + '[담을 항목]\n'
  + 'months : 계획서에 나오는 달만 담습니다. 자료에 없는 달은 넣지 않습니다(열두 달을 억지로 채우지 않습니다). '
  + '항목마다 {"m":3,"theme":"주제(프로그램명)","target":"대상","method":"운영 방법","content":"주요 내용"} 으로 씁니다. '
  + 'm 은 달 숫자(3~12, 1, 2)이며 어린이집 학년도 순서(3,4,5,6,7,8,9,10,11,12,1,2)로 정렬합니다. '
  + 'theme 은 계획서에 적힌 프로그램 이름을 그대로 씁니다. target 은 대상(예: 아빠, 엄마, 가족 모두). '
  + 'method 는 어디에서 어떻게 하는지 한 구절. content 는 어떤 활동인지 한 문장. '
  + '계획서에 대상·방법·내용이 없으면 그 칸만 빈 문자열로 둡니다.\n'
  + 'year : 계획서의 학년도 시작 연도 네 자리(예: 2026). 알 수 없으면 "".\n'
  + 'missing : 계획서에서 찾지 못한 것을 원장님이 알아볼 수 있게 한국어 문장으로. 예) 6월 계획이 자료에 없습니다. 없으면 빈 배열.\n'
  + '아래 JSON 하나만 출력합니다. {"year":"","months":[],"missing":[]}';

// ② 실시기록 분석 (+ 평가는 올린 기록을 근거로 AI가 분석해 쓴다)
const RECORD_SYSTEM = `${TIDY_RULE}\n`
  + '지금 볼 자료는 어린이집이 이미 작성해 둔 부모참여프로그램 실시기록(결과보고서)입니다.\n'
  + '[담을 항목]\n'
  + 'theme : 프로그램 이름. 없으면 "".\n'
  + 'date : 운영한 날짜를 YYYY-MM-DD 로. 없으면 "".\n'
  + 'time : 운영 시각. 예) 오전 10시 ~ 11시 30분. 없으면 "".\n'
  + 'place : 장소. 없으면 "".\n'
  + 'target : 대상. 예) 만 3세반 부모 및 영유아. 없으면 "".\n'
  + 'parents / kids / staff : 참석한 부모·영유아·교직원 수를 숫자만. 자료에 없으면 "".\n'
  + '  ⚠️ 자료에 총 인원만 있으면 알 수 있는 것만 채우고 나머지는 "" 로 둡니다. 인원을 추측해서 나누지 않습니다.\n'
  + 'flow : 그날의 진행 순서입니다. 항목마다 {"time":"시간","content":"운영 내용"}. '
  + 'time 은 09:30 ~ 10:00 처럼 씁니다. 자료에 시간이 없으면 빈 문자열로 두고 순서만 담습니다. '
  + 'content 는 무엇을 어떻게 했는지 한두 문장. 자료에 있는 순서를 그대로 지킵니다.\n'
  + 'summary : 부모참여프로그램 진행내용 4~6문장. 어떤 활동을 했고 부모와 영유아가 어떻게 참여했는지를 자료에 적힌 내용으로 서술합니다.\n'
  + 'review : **평가**입니다. 올린 실시기록을 근거로 분석해서 씁니다. '
  + '무엇이 잘 되었는지, 부모의 반응·의견은 어떠했는지, 다음 프로그램에서 보완할 점은 무엇인지를 4~6문장으로 쓰고, '
  + '마지막에는 수렴한 의견을 어린이집 운영에 어떻게 반영할지 한 문장으로 맺습니다. '
  + '자료에 평가가 이미 적혀 있으면 그 내용을 살려 다듬고, 없으면 자료에 담긴 활동·참여 모습에서 읽어낼 수 있는 범위로만 씁니다. '
  + '없는 성과나 숫자는 만들지 않습니다.\n'
  + 'summary 와 review 의 문장은 모두 ~하였다, ~였다, ~보였다, ~필요하다, ~반영하고자 한다 처럼 서술체로 맺습니다. '
  + '~합니다, ~습니다, ~됩니다 같은 존댓말은 한 문장도 쓰지 않습니다.\n'
  + 'missing : 자료에서 찾지 못해 비워 둔 것을 한국어 문장으로. 예) 참석 인원이 자료에 없습니다. 없으면 빈 배열.\n'
  + '아래 JSON 하나만 출력합니다. '
  + '{"theme":"","date":"","time":"","place":"","target":"","parents":"","kids":"","staff":"","flow":[],"summary":"","review":"","missing":[]}';

// ③ 최종 문서 맨 앞 '필요성'
const NEED_SYSTEM =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
  + '지금 쓸 것은 어린이집 부모참여프로그램의 필요성입니다. '
  + '부모가 어린이집의 놀이와 일과에 직접 참여해 자녀의 생활을 함께 보고, 어린이집 운영을 이해하며 신뢰를 쌓는다는 내용을 담습니다. '
  + '열린어린이집이 지향하는 부모 참여와 소통의 취지, 참여로 얻는 효과(부모·영유아·교직원), '
  + '부모 의견을 보육과정에 반영한다는 점까지 6~8문장으로 씁니다. '
  + '알려준 우리 원의 실제 운영 내용(연간계획 주제·실시한 달)이 있으면 자연스럽게 담되 숫자는 지어내지 않습니다. '
  + '문장은 ~한다, ~하였다 처럼 서술체로 맺습니다.';

// ④ 전체 문서를 보고 고쳐 달라고 한 것을 반영
const REVISE_SYSTEM = `${TIDY_RULE}\n`
  + '지금은 원장이 완성된 전체 문서를 읽고 고쳐 달라고 한 부분을 반영하는 일입니다.\n'
  + '아래에 지금 문서에 들어 있는 글(필요성, 달마다의 진행내용·평가)과 원장의 요청을 함께 드립니다. '
  + '**요청과 관련된 글만 고쳐서 돌려주고, 손댈 필요가 없는 글은 아예 넣지 않습니다.**\n'
  + 'need : 필요성을 고쳤으면 고친 전문. 안 고쳤으면 넣지 않습니다.\n'
  + 'months : 고친 달만 [{"key":"2026-03","summary":"","review":""}] 로. '
  + 'key 는 알려드린 그대로 씁니다. summary 나 review 중 고친 것만 채우고 안 고친 것은 빈 문자열로 둡니다.\n'
  + 'changed : 무엇을 어떻게 고쳤는지 원장님이 알아볼 수 있게 한국어 한 문장씩 배열로. 예) 3월 평가에 아버지 참여가 많았다는 내용을 넣었습니다.\n'
  + 'note : 요청 가운데 이 화면에서 고칠 수 없는 것이 있으면 어디서 고쳐야 하는지 안내 한 문장. 없으면 "".\n'
  + '진행내용과 평가의 문장은 모두 ~하였다, ~였다 처럼 서술체로 맺습니다. 존댓말은 쓰지 않습니다.\n'
  + '아래 JSON 하나만 출력합니다. {"need":"","months":[],"changed":[],"note":""}';

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const body = await request.json();
    const {
      kind, center, year, month, planText,
      planSrc, recordSrc, etcSrc,
      docText, request: askText,
      previous, feedback,
    } = body;

    let system;
    let user;
    let json = false;

    if (kind === 'plan') {
      if (!String(planSrc || '').trim()) {
        return Response.json({ error: '연간 운영계획 자료가 없습니다. 계획서 파일을 먼저 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = PLAN_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `학년도: ${year || ''}년 3월 ~ ${Number(year || 2026) + 1}년 2월`,
        '',
        `[올린 연간 운영계획 원문]\n${planSrc}`,
      ].join('\n');
    } else if (kind === 'record') {
      if (!String(recordSrc || '').trim() && !String(etcSrc || '').trim()) {
        return Response.json({ error: '분석할 실시기록 자료가 없습니다. 파일을 먼저 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = RECORD_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        month ? `이 달: ${month}` : '',
        planText ? `연간계획에 세워 둔 이 달 계획: ${planText}` : '',
        '',
        recordSrc ? `[올린 자료 ① 실시기록]\n${recordSrc}` : '[올린 자료 ① 실시기록] (없음)',
        etcSrc ? `\n[올린 자료 ② 공지문 등 참고 자료]\n${etcSrc}` : '',
      ].filter((x) => x !== '').join('\n');
    } else if (kind === 'need') {
      system = NEED_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `학년도: ${year || ''}년 3월 ~ ${Number(year || 2026) + 1}년 2월`,
        planText ? `우리 원 연간계획 주제:\n${planText}` : '',
      ].filter(Boolean).join('\n');
    } else if (kind === 'revise') {
      if (!String(askText || '').trim()) {
        return Response.json({ error: '고칠 부분을 적어 주세요.' }, { status: 400 });
      }
      json = true;
      system = REVISE_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        '',
        `[지금 문서에 들어 있는 글]\n${docText || ''}`,
        '',
        `[원장이 고쳐 달라고 한 부분]\n${askText}`,
      ].join('\n');
    } else {
      return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });
    }

    if (previous && feedback) {
      user += `\n\n[먼저 쓴 글]\n${previous}\n\n[원장이 고쳐 달라고 한 부분]\n${feedback}\n\n위 요청을 반영해 전체를 다시 써 주세요.`;
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
        max_tokens: 8000,
        thinking: { type: 'disabled' },
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || 'AI 서버 오류' }, { status: res.status });
    }
    const text = (data.content || []).map((b) => b.text || '').join('\n').trim();
    if (!text) return Response.json({ error: 'AI가 빈 답을 보냈습니다. 다시 시도해 주세요.' }, { status: 502 });
    if (json) return Response.json({ result: parseAiJson(text) });
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
