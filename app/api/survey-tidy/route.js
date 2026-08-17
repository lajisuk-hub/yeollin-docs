// 부모만족도조사 "기존 서류 정리" — 원장님이 올린 공지문·설문 응답 자료에서 뽑은 글자를
// 우리 결과서 서식의 항목으로 나누어 돌려준다. (새로 지어내는 것이 아니라 정리하는 것)
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

const TIDY_RULE =
  '당신은 어린이집 학부모 만족도 조사 서류를 정리하는 보육행정 전문가입니다. '
  + '원장이 이미 가지고 있던 문서에서 글자를 뽑아 넘겨 줍니다. 당신이 할 일은 그 내용을 우리 서식의 항목으로 나누어 담는 것입니다.\n'
  + '가장 중요한 규칙: **자료에 있는 내용을 옮겨 담는 것이 우선이고, 없는 사실·숫자·의견은 절대 지어내지 않습니다.** '
  + '특히 점수와 인원은 자료에 적혀 있거나 자료로 계산할 수 있을 때만 채우고, 그렇지 않으면 비워 둡니다. '
  + '자료에 없으면 빈 문자열("") 또는 0으로 두고 missing 목록에 무엇이 없었는지 적습니다. '
  + '파일에서 글자를 뽑는 과정에서 줄바꿈이나 띄어쓰기가 깨져 있을 수 있으니 문장을 알아보고 자연스럽게 다시 정리합니다. '
  + '큰따옴표(")는 쓰지 않습니다.';

// 다섯 영역 설명 (문항을 어느 영역에 넣을지 판단하는 기준)
const AREA_RULE =
  '영역(area)은 반드시 다음 다섯 가지 중 하나입니다.\n'
  + '  env  = 어린이집 환경 (시설·설비·위생·안전 환경·교구와 놀잇감)\n'
  + '  open = 운영의 개방성 (원장·교직원 신뢰, 정보 안내, 부모 대상 행사와 소통)\n'
  + '  course = 보육과정 (보육 철학·프로그램·하루일과·아이의 참여)\n'
  + '  inter = 상호작용 (교사와 아이의 상호작용, 교사와 부모의 소통)\n'
  + '  safe = 건강·안전 (급간식·청결·위생지도·안전교육과 사고 대응)\n';

// ① 조사 공지 분석
const NOTICE_SYSTEM = `${TIDY_RULE}\n`
  + '지금 볼 자료는 어린이집이 조사 전에 부모님께 보낸 만족도 조사 공지(가정통신문)입니다.\n'
  + '[담을 항목]\n'
  + 'greeting : 공지문의 인사말. 자료의 문장을 살려 다듬습니다. 조사 기간·대상·방법은 문서에서 표로 따로 보여주므로 인사말에 다시 나열하지 않습니다. 한 문장씩 줄바꿈.\n'
  + 'closing : 공지문의 맺음말(제출 부탁·결과 안내 예고). 한 문장씩 줄바꿈.\n'
  + 'from / to : 조사 기간의 시작일과 마지막 날을 YYYY-MM-DD 로. 자료에 없으면 "".\n'
  + 'ways : 조사 방법을 짧은 문장 배열로. 예) 가정통신문·키즈노트 공지사항을 통하여 부모만족도 조사 안내. 없으면 빈 배열.\n'
  + 'parents : 조사 대상 부모 수를 숫자만. 없으면 "".\n'
  + 'copies : 설문지 배부 부수를 숫자만. 공지에 배부 ○부 처럼 적혀 있으면 담습니다. 없으면 "".\n'
  + 'twins : 쌍둥이 포함처럼 인원에 대한 비고. 없으면 "".\n'
  + 'missing : 공지에서 찾지 못한 것을 원장님이 알아볼 수 있게 한국어 문장으로. 없으면 빈 배열.\n'
  + '아래 JSON 하나만 출력합니다. {"greeting":"","closing":"","from":"","to":"","ways":[],"parents":"","copies":"","twins":"","missing":[]}';

// ② 조사 내용(설문지 + 회신 응답) 분석
const CONTENT_SYSTEM = `${TIDY_RULE}\n`
  + '지금 볼 자료는 어린이집이 실시한 학부모 만족도 조사의 설문지와 회신된 응답 자료입니다. '
  + '파일이 여러 개(응답자별 설문지 등)일 수 있으며 [파일이름] 으로 구분되어 있습니다.\n'
  + `${AREA_RULE}`
  + '[담을 항목]\n'
  + 'questions : 설문지의 문항들. [{"area":"env","text":"문항 전문"}] 형태로 순서대로 담습니다. '
  + '설문지가 자료에 없으면 빈 배열.\n'
  + 'qScores : 문항별 평균 점수. [{"area":"env","text":"문항 전문","score":4.3}]. '
  + '**응답 자료로 실제 계산할 수 있을 때만** 담습니다. 계산할 수 없으면 빈 배열로 두고 missing 에 적습니다. '
  + '척도는 매우만족 5 / 만족 4 / 보통 3 / 불만 2 / 매우불만 1 로 환산하고 소수 첫째 자리까지 씁니다. '
  + '자료의 척도가 4단계(매우만족·만족·보통·불만족)이면 매우만족 5 / 만족 4 / 보통 3 / 불만족 2 로 환산합니다.\n'
  + 'scores : 영역별 평균 점수 {"env":4.2,"open":4.4,"course":4.3,"inter":4.3,"safe":4.3}. '
  + '그 영역 문항들의 평균으로 계산합니다. 계산할 수 없는 영역은 0 으로 둡니다.\n'
  + 'parents / copies / replies : 조사 대상 부모 수 / 배부 부수 / 회신 수를 숫자만. 자료에서 셀 수 있으면 세고, 알 수 없으면 "".\n'
  + 'twins : 쌍둥이 포함 등 인원에 대한 비고. 없으면 "".\n'
  + 'good : 결과에서 잘된 점. 자료에 나타난 높은 점수 영역과 부모님의 긍정적인 의견을 근거로 - 로 시작하는 짧은 줄 2~3개. 줄바꿈은 \\n.\n'
  + 'improve : 개선 의견. 점수가 낮은 영역과 부모님이 적어 주신 건의사항을 근거로 - 로 시작하는 짧은 줄 2~4개. '
  + '부모님이 실제로 쓴 의견은 표현을 살려 옮깁니다. 줄바꿈은 \\n.\n'
  + '⚠️ good 과 improve 는 이 어린이집 서식대로 **개조식(명사형)**으로 짧게 씁니다. '
  + '예) - 운영의 개방성 부분에서 가장 높은 만족도를 보임 / - 어린이집 환경 만족도가 전체 평균보다 낮아 항목 중 가장 낮음 / - 급식시 백김치가 더 많이 반영되었으면 함. '
  + '~습니다, ~있었습니다 같은 존댓말 문장으로 쓰지 않습니다.\n'
  + 'action : 어린이집 조치사항. 위 개선 의견 하나하나에 대해 어린이집이 어떻게 하겠다는 답을 ▪ 로 시작하는 줄로 씁니다. '
  + '조치사항은 부모님께 드리는 답이므로 ~하겠습니다 존댓말로 씁니다. '
  + '개선 의견에 대응하지 않는 내용은 넣지 않습니다. 줄바꿈은 \\n.\n'
  + 'missing : 자료에서 찾지 못해 비워 둔 것을 한국어 문장으로. 예) 회신된 응답 자료가 없어 평균 점수를 계산하지 못했습니다. 없으면 빈 배열.\n'
  + '아래 JSON 하나만 출력합니다. '
  + '{"questions":[],"qScores":[],"scores":{},"parents":"","copies":"","replies":"","twins":"","good":"","improve":"","action":"","missing":[]}';

// ③ 필요성 / ④ 내년 반영 내용
const NEED_SYSTEM =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
  + '지금 쓸 것은 학부모 만족도 조사의 필요성입니다. '
  + '**매년 1회 전체 학부모를 대상으로 조사하고 결과를 숨김없이 공개하여 투명한 어린이집 운영을 실천한다**는 내용을 반드시 담습니다. '
  + '보육의 질을 높이기 위해 학부모 의견을 정기적으로 확인한다는 취지, 무기명 조사로 솔직한 의견을 받는다는 점, '
  + '결과를 다음 해 운영 계획에 반영한다는 점까지 6~8문장으로 씁니다. 한 문장씩 줄바꿈합니다.';

const PLAN_SYSTEM =
  '당신은 어린이집 원장을 돕는 보육행정 문서 전문가입니다. 큰따옴표(")는 쓰지 않습니다. '
  + '설명이나 머리말 없이 문서에 들어갈 본문만 출력합니다. 제목은 넣지 않습니다. '
  + '지금 쓸 것은 만족도 조사 결과를 다음 해 어린이집 운영에 어떻게 반영할지입니다. '
  + '알려준 영역별 점수에서 **가장 낮은 영역을 우선 개선 과제로** 삼고, 부모님이 주신 건의사항을 항목별로 정리해 담당과 시기를 정하겠다는 내용, '
  + '개선 상황을 운영위원회와 가정통신문으로 안내하겠다는 내용, 다음 해에도 조사를 실시해 개선 여부를 확인하겠다는 내용을 담습니다. '
  + '첫째, 둘째, 셋째, 넷째로 나누어 씁니다. 한 항목씩 줄바꿈합니다. 알려주지 않은 숫자는 지어내지 않습니다.';

// ④ 전체 문서를 보고 고쳐 달라고 한 것을 반영
const REVISE_SYSTEM = `${TIDY_RULE}\n`
  + '지금은 원장이 완성된 전체 문서를 읽고 고쳐 달라고 한 부분을 반영하는 일입니다.\n'
  + '아래에 지금 문서에 들어 있는 글과 원장의 요청을 함께 드립니다. '
  + '**요청과 관련된 글만 고쳐서 돌려주고, 손댈 필요가 없는 글은 아예 넣지 않습니다.**\n'
  + '고칠 수 있는 항목: need(필요성) / noticeGreeting(공지 인사말) / noticeClosing(공지 맺음말) / intro(설문지 안내글) / '
  + 'good(잘된 점) / improve(개선 의견) / action(조치사항) / plan(내년 반영 내용).\n'
  + 'changed : 무엇을 어떻게 고쳤는지 원장님이 알아볼 수 있게 한국어 한 문장씩 배열로.\n'
  + 'note : 요청 가운데 이 화면에서 고칠 수 없는 것(점수·인원처럼 표에 들어가는 값 등)이 있으면 어디서 고쳐야 하는지 안내 한 문장. 없으면 "".\n'
  + '점수와 인원은 절대 바꾸지 않습니다.\n'
  + '아래 JSON 하나만 출력합니다. '
  + '{"need":"","noticeGreeting":"","noticeClosing":"","intro":"","good":"","improve":"","action":"","plan":"","changed":[],"note":""}';

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API 키가 설정되지 않았습니다 (ANTHROPIC_API_KEY)' }, { status: 500 });
    }

    const body = await request.json();
    const {
      kind, center, year, period, size,
      noticeSrc, contentSrc, scoreText, memo,
      docText, request: askText, previous, feedback,
    } = body;

    let system;
    let user;
    let json = false;

    if (kind === 'notice') {
      if (!String(noticeSrc || '').trim()) {
        return Response.json({ error: '조사 공지 자료가 없습니다. 공지문 파일을 먼저 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = NOTICE_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `조사 연도: ${year || ''}년`,
        '',
        `[올린 자료 — 부모만족도 조사 공지]\n${noticeSrc}`,
      ].join('\n');
    } else if (kind === 'content') {
      if (!String(contentSrc || '').trim()) {
        return Response.json({ error: '조사 내용 자료가 없습니다. 설문지·응답 파일을 먼저 올려 주세요.' }, { status: 400 });
      }
      json = true;
      system = CONTENT_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `조사 연도: ${year || ''}년`,
        period ? `조사 기간: ${period}` : '',
        size ? `원장이 알려준 조사 규모: ${size}` : '',
        memo ? `원장이 덧붙인 의견·특이사항:\n${memo}` : '',
        '',
        `[올린 자료 — 부모만족도 조사 내용(설문지와 회신 응답)]\n${contentSrc}`,
      ].filter((x) => x !== '').join('\n');
    } else if (kind === 'need') {
      system = NEED_SYSTEM;
      user = [`어린이집: ${center || ''}`, `조사 연도: ${year || ''}년`, period ? `조사 기간: ${period}` : '']
        .filter(Boolean).join('\n');
    } else if (kind === 'plan') {
      system = PLAN_SYSTEM;
      user = [
        `어린이집: ${center || ''}`,
        `조사 연도: ${year || ''}년`,
        scoreText ? `영역별 평균 점수: ${scoreText}` : '',
        memo ? `부모님 건의사항:\n${memo}` : '',
      ].filter(Boolean).join('\n');
    } else if (kind === 'revise') {
      if (!String(askText || '').trim()) {
        return Response.json({ error: '고칠 부분을 적어 주세요.' }, { status: 400 });
      }
      json = true;
      system = REVISE_SYSTEM;
      user = [
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
        max_tokens: 12000,
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
