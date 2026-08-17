// 부모 어린이집 참관 "기존 서류 정리" — 올린 참관 안내문에
// 심사에서 보는 세 가지(참관 자격 · 시기 · 방법)가 들어 있는지 점검해 준다.
// ⚠️ 참관은 서류제출이 아니라 현장확인 항목이라, 새 문장을 지어 주는 것이 아니라
//    "안내문에 무엇이 빠졌는지" 알려주는 것이 핵심이다.
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

const CHECK_SYSTEM =
  '당신은 열린어린이집 심사 서류를 점검하는 보육행정 전문가입니다. '
  + '원장이 어린이집에 게시하고 있는 부모 참관 안내문에서 글자를 뽑아 넘겨 줍니다. '
  + '당신이 할 일은 그 안내문에 심사에서 보는 세 가지가 들어 있는지 확인해 주는 것입니다.\n'
  + '큰따옴표(")는 쓰지 않습니다. 안내문에 없는 내용을 있다고 하지 않습니다.\n'
  + '[심사에서 보는 세 가지]\n'
  + '  who  = 참관 자격 (누가 참관할 수 있는지)\n'
  + '  when = 참관 시기 (언제 참관할 수 있는지)\n'
  + '  how  = 참관 방법 (어떻게 신청하고 참관하는지)\n'
  + '[담을 항목]\n'
  + 'who / when / how : 각각 {"ok":true 또는 false, "found":"안내문에서 그렇게 판단한 부분을 그대로 옮긴 짧은 글"}. '
  + '안내문에 없으면 ok는 false, found는 "".\n'
  + '⚠️ when 은 특히 중요합니다. **연중 상시**로 참관할 수 있다고 되어 있어야 ok 입니다. '
  + '매월 ○주만, 특정 요일만, 특정 기간만, 특정 반만처럼 조건이 걸려 있으면 ok 는 false 로 하고 '
  + 'found 에 그 제한 문구를 옮깁니다. (제한된 운영은 상시 운영으로 인정되지 않습니다)\n'
  + 'limits : 안내문에서 발견한 제한 표현들(기간·요일·반 제한, 사전 예약 며칠 전 필수 등)을 한국어 문장 배열로. 없으면 빈 배열.\n'
  + 'advice : 원장님이 바로 고칠 수 있게 무엇을 어떻게 보완하면 좋은지 2~4문장으로. '
  + '빠진 항목이 있으면 어떤 문장을 넣으면 되는지 예시 문장까지 알려 줍니다. 세 가지가 모두 있으면 잘 갖춰져 있다고 알려 줍니다.\n'
  + '⚠️ advice 는 어린이집 원장님이 읽는 글입니다. who · when · how 같은 영어 낱말을 쓰지 말고 '
  + '**참관 자격 · 참관 시기 · 참관 방법**이라고 한국어로 씁니다. 전문용어 없이 쉽게 씁니다.\n'
  + '⚠️ 참관 방법 예시 문장을 드릴 때 **며칠 전까지 신청, 사전 예약 필수처럼 제한이 되는 표현은 절대 쓰지 않습니다.** '
  + '상시 운영에 어긋나기 때문입니다. 예) 참관을 원하시는 날 어린이집으로 연락 주시면 바로 안내해 드립니다. 당일 신청도 가능합니다.\n'
  + '아래 JSON 하나만 출력합니다. '
  + '{"who":{"ok":false,"found":""},"when":{"ok":false,"found":""},"how":{"ok":false,"found":""},"limits":[],"advice":""}';

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const { kind, center, noticeSrc } = await request.json();
    if (kind !== 'check') return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });
    if (!String(noticeSrc || '').trim()) {
      return Response.json({ error: '안내문에서 글자를 찾지 못했습니다. 글자가 들어 있는 PDF나 한글 파일로 올려 주세요.' }, { status: 400 });
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
        max_tokens: 4000,
        thinking: { type: 'disabled' },
        system: CHECK_SYSTEM,
        messages: [{ role: 'user', content: `어린이집: ${center || ''}\n\n[게시 중인 참관 안내문]\n${noticeSrc}` }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || 'AI 서버 오류' }, { status: res.status });
    }
    const text = (data.content || []).map((b) => b.text || '').join('\n').trim();
    if (!text) return Response.json({ error: 'AI가 빈 답을 보냈습니다. 다시 시도해 주세요.' }, { status: 502 });
    return Response.json({ result: parseAiJson(text) });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
