// 지자체 자체기준 "서류 정리" — 원장이 올린 자료(수료증·참석확인서·공문 등)를 읽어
// "우리 원이 무엇을 충족했는지" 항목별로 정리해 준다.
// ⚠️ 지자체 항목은 지역마다 다르므로 정해진 목록에 억지로 맞추지 않고 자료에 있는 대로 뽑는다.
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

const ANALYZE_SYSTEM =
  '당신은 열린어린이집 서류를 정리하는 보육행정 전문가입니다. '
  + '원장이 지자체 자체기준을 충족했다는 자료(수료증·참석확인서·공문·안내문·사진 설명 등)에서 뽑은 글자를 넘겨 줍니다. '
  + '당신이 할 일은 그 자료를 보고 **우리 어린이집이 무엇을 충족했는지** 항목으로 나누어 정리하는 것입니다.\n'
  + '가장 중요한 규칙: **자료에 있는 내용만 옮겨 담고, 없는 사실·날짜·이름은 절대 지어내지 않습니다.** '
  + '없으면 빈 문자열("")로 두고 missing 에 무엇이 없었는지 적습니다. '
  + '⚠️ 지자체 자체기준은 **관할 시·군·구마다 항목이 다릅니다.** 정해진 목록에 억지로 끼워 맞추지 말고, '
  + '자료에 나타난 그대로 항목을 뽑습니다. 자료가 여러 건이면 건별로 나눕니다.\n'
  + '큰따옴표(")는 쓰지 않습니다.\n'
  + '[담을 항목]\n'
  + 'region : 자료에 나오는 관할 지자체 이름(예: ○○시, ○○구). 없으면 "".\n'
  + 'items : 충족한 항목들입니다. 항목마다 '
  + '{"title":"충족 항목 이름","when":"일시","where":"주관 기관 · 장소","who":"참석자","content":"내용","proof":"증빙 자료 이름"}.\n'
  + '  title 은 심사표에 적을 수 있게 짧게 (예: 열린어린이집 사업설명회 참여, 어린이집 재무회계 교육 이수, 문서컨설팅 참여).\n'
  + '  when 은 자료에 적힌 날짜 그대로 (예: 2026. 3. 12.). 없으면 "".\n'
  + '  where 는 주관 기관과 장소 (예: ○○시 육아종합지원센터 / 온라인). 없으면 "".\n'
  + '  who 는 참석한 사람 (예: 원장 1명). 없으면 "".\n'
  + '  content 는 무엇을 했고 무엇을 이수했는지 2~4문장. ~하였다 서술체로 씁니다.\n'
  + '  proof 는 증빙이 되는 문서 이름 (예: 수료증, 참석확인서, 이수증). 없으면 "".\n'
  + 'missing : 자료에서 찾지 못해 비워 둔 것을 원장님이 알아볼 수 있게 한국어 문장 배열로. 없으면 빈 배열.\n'
  + 'advice : 지자체 자체기준은 지역마다 다르므로, 관할 공고를 확인해 빠진 항목이 없는지 살펴보시라는 안내와 '
  + '지금 올린 자료로 보이는 상태를 2~3문장으로 알려 줍니다. 전문용어 없이 쉽게 씁니다.\n'
  + '아래 JSON 하나만 출력합니다. {"region":"","items":[],"missing":[],"advice":""}';

const INTRO_SYSTEM =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
  + '지금 쓸 것은 지자체 자체기준 충족 내용 문서의 앞머리 안내글입니다. '
  + '지자체 자체기준은 관할 지자체가 정하는 항목이라 지역마다 다르다는 점, '
  + '우리 어린이집이 관할 지자체 기준을 확인하고 해당 항목에 참여·이수하였다는 점, '
  + '증빙 자료를 어린이집에 보관하고 아래에 정리하였다는 점을 4~6문장으로 씁니다. '
  + '알려준 충족 항목이 있으면 자연스럽게 담되 없는 내용은 지어내지 않습니다. 한 문장씩 줄바꿈합니다.';

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, year, region, src, itemsText, previous, feedback } = await request.json();

    let system;
    let user;
    let json = false;

    if (kind === 'analyze') {
      if (!String(src || '').trim()) {
        return Response.json({ error: '올린 자료에서 글자를 찾지 못했습니다. 글자가 들어 있는 파일로 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = ANALYZE_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `연도: ${year || ''}년`,
        region ? `관할 지자체: ${region}` : '',
        '',
        `[올린 지자체 충족 자료]\n${src}`,
      ].filter((x) => x !== '').join('\n');
    } else if (kind === 'intro') {
      system = INTRO_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `연도: ${year || ''}년`,
        region ? `관할 지자체: ${region}` : '',
        itemsText ? `충족 항목:\n${itemsText}` : '',
      ].filter(Boolean).join('\n');
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
