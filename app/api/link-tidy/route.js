// 다양성(연계·협력) "기존 서류 정리" — 올린 연간계획·결과보고서를 우리 서식 항목으로 정리한다.
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

const TIDY_RULE =
  '당신은 어린이집 연계·협력(다양성) 서류를 정리하는 보육행정 전문가입니다. '
  + '원장이 이미 가지고 있던 문서에서 글자를 뽑아 넘겨 줍니다. 그 내용을 우리 서식의 항목으로 나누어 담는 것이 당신의 일입니다.\n'
  + '가장 중요한 규칙: **자료에 있는 내용을 옮겨 담는 것이 우선이고, 없는 사실·숫자·이름·날짜는 절대 지어내지 않습니다.** '
  + '자료에 없으면 빈 문자열("")로 두고 missing 목록에 무엇이 없었는지 적습니다. '
  + '파일에서 글자를 뽑는 과정에서 줄바꿈이 깨져 있을 수 있으니 문장을 알아보고 자연스럽게 정리합니다. '
  + '큰따옴표(")는 쓰지 않습니다.';

const TYPE_RULE =
  '인정 항목(types)은 다음 두 가지 중 해당하는 것을 배열로 담습니다. 둘 다 해당하면 둘 다 담습니다.\n'
  + '  center = 어린이집 간 연계·협력 (다른 어린이집과 함께한 활동)\n'
  + '  local  = 부모참여활동 지역사회 연계 (도서관·소방서·보건소 등 지역 기관과 연계하고 **부모가 함께 참여**한 활동)\n'
  + '⚠️ local 은 부모가 함께 참여한 활동만 해당합니다. 영유아만 참여한 활동은 local 로 넣지 않습니다.\n';

// ① 연간계획 분석
const PLAN_SYSTEM = `${TIDY_RULE}\n${TYPE_RULE}`
  + '지금 볼 자료는 어린이집이 세워 둔 연계·협력(다양성) 연간계획입니다. 회차 표로 정리합니다.\n'
  + '[담을 항목]\n'
  + 'rows : 계획서에 나오는 회차만 담습니다. '
  + '항목마다 {"when":"시기","title":"활동명","partner":"연계 대상","types":["center"],"content":"주요 내용"}. '
  + 'when 은 계획서에 적힌 대로(예: 5월, 2026-05-20, 상반기). 자료에 없는 칸은 빈 문자열.\n'
  + 'year : 계획의 연도 네 자리. 알 수 없으면 "".\n'
  + 'missing : 계획서에서 찾지 못한 것을 한국어 문장 배열로. 없으면 빈 배열.\n'
  + '아래 JSON 하나만 출력합니다. {"year":"","rows":[],"missing":[]}';

// ② 회차별 결과보고서 분석
const RECORD_SYSTEM = `${TIDY_RULE}\n${TYPE_RULE}`
  + '지금 볼 자료는 어린이집이 이미 작성해 둔 연계·협력 활동 결과보고서입니다.\n'
  + '[담을 항목]\n'
  + 'title : 활동명(행사이름). 없으면 "".\n'
  + 'date : 운영 날짜를 YYYY-MM-DD 로. 없으면 "".\n'
  + 'time : 운영 시각. 없으면 "".\n'
  + 'place : 장소. 없으면 "".\n'
  + 'partner : 함께한 어린이집 이름 또는 연계 기관 이름. 없으면 "".\n'
  + 'types : 위 기준에 따른 인정 항목 배열.\n'
  + 'parents / kids / staff : 참여한 부모·영유아·교직원 수를 숫자만. 자료에 없으면 "".\n'
  + 'names : 참여 명단(이름들)이 자료에 있으면 쉼표로 이어 붙여 담습니다. 없으면 "".\n'
  + 'summary : 연계·협력 활동 진행내용 4~6문장. 무엇을 어떻게 했고 누가 어떻게 참여했는지 자료에 적힌 내용으로 서술합니다.\n'
  + 'review : **평가**입니다. 올린 결과보고서를 근거로 분석해 씁니다. '
  + '무엇이 잘 되었는지, 참여자의 반응은 어떠했는지, 다음에 보완할 점은 무엇인지를 4~6문장으로 쓰고, '
  + '마지막에 이 연계를 앞으로 어떻게 이어갈지 한 문장으로 맺습니다. 없는 성과나 숫자는 만들지 않습니다.\n'
  + 'summary 와 review 는 모두 ~하였다, ~였다, ~보였다, ~필요하다 처럼 서술체로 맺습니다. 존댓말은 한 문장도 쓰지 않습니다.\n'
  + 'missing : 자료에서 찾지 못해 비워 둔 것을 한국어 문장 배열로. 없으면 빈 배열.\n'
  + '아래 JSON 하나만 출력합니다. '
  + '{"title":"","date":"","time":"","place":"","partner":"","types":[],"parents":"","kids":"","staff":"","names":"","summary":"","review":"","missing":[]}';

const NEED_SYSTEM =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
  + '지금 쓸 것은 어린이집 연계·협력 활동(다양성)의 필요성입니다. '
  + '다른 어린이집과 프로그램·자원을 나누며 보육의 질을 함께 높인다는 점, '
  + '도서관·소방서·보건소 같은 지역사회 기관과 연계한 활동에 **부모가 함께 참여**하여 마을이 함께 아이를 기른다는 점, '
  + '어린이집을 지역사회에 열어 두는 열린어린이집 운영의 중요한 부분이라는 점을 6~8문장으로 씁니다. '
  + '알려준 우리 원의 실제 활동이 있으면 자연스럽게 담되 숫자는 지어내지 않습니다. 문장은 ~한다, ~하였다 서술체로 맺습니다.';

// ③ 전체 내용 평가
const OVERALL_SYSTEM =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
  + '지금 쓸 것은 한 해 동안 실시한 연계·협력 활동 전체에 대한 평가입니다.\n'
  + '알려준 회차별 활동 내용과 항목별 충족 횟수를 근거로, '
  + '① 올해 어떤 기관과 몇 차례 연계하여 무엇을 했는지 ② 아이와 부모·교직원에게 어떤 성과가 있었는지 '
  + '③ 아쉬웠던 점과 보완할 점 ④ 다음 해에 이 연계를 어떻게 이어갈지를 8~12문장으로 씁니다.\n'
  + '알려주지 않은 성과나 숫자는 만들지 않습니다. 문장은 ~하였다, ~였다, ~필요하다, ~이어가고자 한다 처럼 서술체로 맺습니다. '
  + '~합니다, ~습니다 같은 존댓말은 한 문장도 쓰지 않습니다.';

const REVISE_SYSTEM = `${TIDY_RULE}\n`
  + '지금은 원장이 완성된 전체 문서를 읽고 고쳐 달라고 한 부분을 반영하는 일입니다.\n'
  + '**요청과 관련된 글만 고쳐서 돌려주고, 손댈 필요가 없는 글은 아예 넣지 않습니다.**\n'
  + 'need : 필요성을 고쳤으면 고친 전문.\n'
  + 'acts : 고친 회차만 [{"i":0,"summary":"","review":""}]. i 는 알려드린 회차 번호(0부터). 고친 것만 채웁니다.\n'
  + 'overall : 전체 내용 평가를 고쳤으면 고친 전문.\n'
  + 'changed : 무엇을 어떻게 고쳤는지 한국어 한 문장씩 배열로.\n'
  + 'note : 이 화면에서 고칠 수 없는 것(날짜·인원 등)이 있으면 어디서 고치는지 안내 한 문장. 없으면 "".\n'
  + '회차 글과 전체 평가는 ~하였다 서술체로 맺습니다.\n'
  + '아래 JSON 하나만 출력합니다. {"need":"","acts":[],"overall":"","changed":[],"note":""}';

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const body = await request.json();
    const { kind, center, year, planSrc, recordSrc, actInfo, actsText, counts, docText, request: askText, previous, feedback } = body;

    let system;
    let user;
    let json = false;

    if (kind === 'plan') {
      if (!String(planSrc || '').trim()) {
        return Response.json({ error: '연간계획 자료가 없습니다. 계획서를 먼저 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = PLAN_SYSTEM;
      user = `어린이집: ${center || ''}\n연도: ${year || ''}년\n\n[올린 연계·협력 연간계획]\n${planSrc}`;
    } else if (kind === 'record') {
      if (!String(recordSrc || '').trim()) {
        return Response.json({ error: '결과보고서 자료가 없습니다. 파일을 먼저 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = RECORD_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        actInfo ? `원장이 알려준 이 회차 정보: ${actInfo}` : '',
        '',
        `[올린 결과보고서]\n${recordSrc}`,
      ].filter((x) => x !== '').join('\n');
    } else if (kind === 'need') {
      system = NEED_SYSTEM;
      user = [`어린이집: ${center || ''}`, `연도: ${year || ''}년`, actsText ? `우리 원 연계·협력 활동:\n${actsText}` : '']
        .filter(Boolean).join('\n');
    } else if (kind === 'overall') {
      system = OVERALL_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `연도: ${year || ''}년`,
        counts ? `항목별 충족 횟수: ${counts}` : '',
        actsText ? `회차별 활동 내용:\n${actsText}` : '',
      ].filter(Boolean).join('\n');
    } else if (kind === 'revise') {
      if (!String(askText || '').trim()) {
        return Response.json({ error: '고칠 부분을 적어 주세요.' }, { status: 400 });
      }
      json = true;
      system = REVISE_SYSTEM;
      user = `[지금 문서에 들어 있는 글]\n${docText || ''}\n\n[원장이 고쳐 달라고 한 부분]\n${askText}`;
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
