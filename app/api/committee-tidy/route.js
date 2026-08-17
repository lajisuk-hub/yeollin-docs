// 운영위원회 "기존 서류 정리" — 원장님이 올린 파일에서 뽑은 글자를 분석해
// 문서 서식에 맞는 항목들로 나눠 돌려준다. (새로 지어내는 것이 아니라 정리하는 것)
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

// 올린 자료를 분석해 문서 항목으로 나누기
const ANALYZE_SYSTEM =
  '당신은 어린이집 운영위원회 서류를 정리하는 보육행정 전문가입니다. ' +
  '원장이 이미 만들어 둔 개최 공지문·회의록·회의결과서에서 글자를 뽑아 넘겨 줍니다. ' +
  '당신이 할 일은 그 내용을 우리 서식의 항목으로 나누어 담는 것입니다.\n' +
  '가장 중요한 규칙: **자료에 있는 내용을 옮겨 담는 것이 우선이고, 없는 사실·숫자·이름·날짜는 절대 지어내지 않습니다.** ' +
  '자료에 없으면 그 항목은 빈 문자열("")로 두고, missing 목록에 무엇이 없었는지 적습니다. ' +
  '파일에서 글자를 뽑는 과정에서 줄바꿈이나 띄어쓰기가 깨져 있을 수 있으니, 문장을 알아보고 자연스럽게 다시 정리합니다. ' +
  '큰따옴표(")는 쓰지 않습니다.\n' +
  '[담을 항목]\n' +
  'date : 회의 날짜를 YYYY-MM-DD 로. 자료에 없으면 "".\n' +
  'time : 회의 시각. 예) 오후 5시. 없으면 "".\n' +
  'place : 회의 장소. 없으면 "".\n' +
  'secretary : 간사 이름. 없으면 "".\n' +
  'guests : 위원이 아닌 그 밖의 참석자. 없으면 "".\n' +
  'members : 회의록·공지문에 나오는 운영위원 명단. 각 항목은 {"name":"이름","role":"구분"} 이며 ' +
  'role 은 반드시 원장 / 보육교사 대표 / 학부모 대표 / 지역사회 인사 중 하나로 맞춥니다. ' +
  '(학부모위원→학부모 대표, 교사위원→보육교사 대표, 지역위원→지역사회 인사) 자료에 없으면 빈 배열.\n' +
  'absent : 명단에 있으나 그 회의에 참석하지 않은 위원 이름 배열. 없으면 빈 배열.\n' +
  'agenda : 안건을 한 줄에 하나씩. 번호는 붙이지 않습니다.\n' +
  'noticeGreeting : 개최 공지문의 인사말. 자료의 인사말을 그대로 살려 다듬습니다. 일시·장소·안건은 문서에서 표로 따로 보여주므로 인사말에 다시 나열하지 않습니다. 한 문장씩 줄바꿈.\n' +
  'noticeClosing : 개최 공지문의 맺음말(의견 요청·결과 안내 예고). 한 문장씩 줄바꿈.\n' +
  'order : 회의록의 회의순서. 1. 개회사 로 시작해 안건을 차례로 넣고 기타 안건, 폐회사 로 맺습니다. 한 줄에 하나씩 번호를 붙입니다.\n' +
  'discussion : 회의록의 토의 및 의결사항. 다음 모양을 지킵니다.\n' +
  '  첫 줄은 1. 운영위원회 안건내용 (다만 3월에 연 1/4분기 회의라면 그 앞에 1. 어린이집 운영위원회 위원 위촉 및 위원장 선정 을 먼저 두고 안건내용을 2. 로).\n' +
  '  그 아래 안건마다  1) 안건 이름 / ● 《어린이집》 보고·설명한 내용(여러 가지면 ① ② ③, 결정 제안은 ▶) / ● (운영위원) 위원 의견 / → (어린이집) 답변.\n' +
  '  안건 사이는 빈 줄로 나눕니다. 자료에 위원 의견이 없으면 ● (운영위원) 줄과 → 줄은 넣지 않습니다. 맺음말은 넣지 않습니다(문서가 자동으로 붙입니다).\n' +
  'resultIntro : 회의결과 안내문의 머리말. 예) 2026년 2월 2일(월)에 개최되었으며 대면회의를 진행하였고 결과를 다음과 같이 안내합니다.\n' +
  'resultItems : 회의결과 안내문의 안건별 내용. [{"title":"안건 이름","body":"내용"}]. body 는 ● 《어린이집》 / ● 《운영위원》 / → 모양으로 개조식(~함, ~하겠음)으로 씁니다. 줄바꿈은 \\n.\n' +
  'resultClosing : ★ 로 시작하는 감사 인사 3~5문장.\n' +
  'feature : 그 분기 운영위원회 운영의 특징을 4~6문장으로 정리. 자료에 담긴 내용만으로 씁니다.\n' +
  'missing : 자료에서 찾지 못해 비워 둔 것들을 원장님이 알아볼 수 있게 한국어 문장으로. 예) 회의 장소가 자료에 없습니다. 없으면 빈 배열.\n' +
  '연도 표기는 회의 날짜를 기준으로 바로잡습니다. 자료의 연도가 회의 날짜와 어긋나면 회의 날짜를 따릅니다.\n' +
  '아래 JSON 하나만 출력합니다. ' +
  '{"date":"","time":"","place":"","secretary":"","guests":"","members":[],"absent":[],"agenda":"","noticeGreeting":"","noticeClosing":"","order":"","discussion":"","resultIntro":"","resultItems":[],"resultClosing":"","feature":"","missing":[]}';

// 회칙은 법령에 따른 문서라 내용을 바꾸지 않는다. 줄만 정리한다.
const RULES_SYSTEM =
  '당신은 문서 편집자입니다. 어린이집 운영위원회 회칙을 PDF·한글에서 글자만 뽑아 넘겨 주므로 줄바꿈과 띄어쓰기가 깨져 있습니다. ' +
  '당신이 할 일은 오직 줄을 바로잡는 것입니다.\n' +
  '**절대 규칙: 글자를 바꾸지 않습니다. 조문을 새로 넣거나 빼거나 요약하거나 순서를 바꾸지 않습니다. 없는 조문을 만들지 않습니다.**\n' +
  '- 장(제1장 …) · 조(제1조(목적) …) · 항(① ② ③) · 호(1. 2. 3.)가 각각 새 줄에서 시작하도록 줄바꿈만 넣습니다.\n' +
  '- 조문 사이는 빈 줄 하나로 띄웁니다.\n' +
  '- 쪽 번호, 머리글, 반복되는 파일 이름처럼 회칙 본문이 아닌 것은 지웁니다.\n' +
  '- 오탈자도 고치지 않습니다. 원문 그대로 둡니다.\n' +
  '설명이나 머리말 없이 정리한 회칙 전문만 출력합니다.';

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const body = await request.json();
    const { kind, center, quarter, when, noticeSrc, minutesSrc, resultSrc, etcSrc, rulesSrc, previous, feedback } = body;

    let system;
    let user;
    let json = false;

    if (kind === 'rules') {
      if (!String(rulesSrc || '').trim()) {
        return Response.json({ error: '회칙 파일에서 글자를 찾지 못했습니다' }, { status: 400 });
      }
      system = RULES_SYSTEM;
      user = `[올린 회칙 원문 — 글자를 바꾸지 말고 줄만 정리해 주세요]\n${rulesSrc}`;
    } else if (kind === 'analyze') {
      const has = [noticeSrc, minutesSrc, resultSrc, etcSrc].some((t) => String(t || '').trim());
      if (!has) {
        return Response.json({ error: '분석할 자료가 없습니다. 공지문·회의록·회의결과서 중 하나라도 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = ANALYZE_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `이 차수: ${quarter || ''}`,
        when ? `원장이 알려준 회의 일시: ${when}` : '',
        '',
        noticeSrc ? `[올린 자료 ① 개최 공지문]\n${noticeSrc}` : '[올린 자료 ① 개최 공지문] (없음)',
        '',
        minutesSrc ? `[올린 자료 ② 회의록]\n${minutesSrc}` : '[올린 자료 ② 회의록] (없음)',
        '',
        resultSrc ? `[올린 자료 ③ 회의결과서]\n${resultSrc}` : '[올린 자료 ③ 회의결과서] (없음)',
        etcSrc ? `\n[올린 자료 ④ 그 밖의 참고 자료]\n${etcSrc}` : '',
      ].filter((x) => x !== undefined && x !== '').join('\n');
      if (previous && feedback) {
        user += `\n\n[먼저 정리한 결과]\n${previous}\n\n[원장이 고쳐 달라고 한 부분]\n${feedback}\n\n위 요청을 반영해 전체를 다시 정리해 주세요.`;
      }
    } else {
      return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });
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
    if (json) {
      const r = parseAiJson(text);
      // 원장님 서식은 ● 《어린이집》 / ● 《운영위원》 (→ 답변 줄은 괄호 그대로)
      const fix = (s) => String(s || '')
        .replace(/●\s*\(\s*어린이집\s*\)/g, '● 《어린이집》')
        .replace(/●\s*\(\s*운영위원\s*\)/g, '● 《운영위원》');
      if (r.discussion) r.discussion = fix(r.discussion);
      if (Array.isArray(r.resultItems)) {
        r.resultItems = r.resultItems.map((x) => ({ ...x, body: fix(x?.body) }));
      }
      return Response.json({ result: r });
    }
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
