// 두 곳(휴대폰·컴퓨터, 또는 서로 다른 브라우저)에 나뉘어 있는 내용을 **칸 단위로 합친다**.
//
// ★ 왜 이 파일이 생겼나 (2026-09-03 사고)
// 예전에는 "나중에 저장된 쪽으로 통째로 바꿔치기" 했다.
// 그러다 보니 한쪽에만 있던 내용(사전질문 답변·AI 계획 등)이 통째로 사라졌다.
// 실제로 수강생 두 분의 내용이 지워졌다.
//
// 이제는 이렇게 한다.
//  · 칸마다 따로 비교한다 (한쪽에만 있는 칸은 절대 안 지운다)
//  · **빈 칸은 채워진 칸을 이길 수 없다** (빈 브라우저가 서버 내용을 덮어쓰지 못한다)
//  · 양쪽 다 값이 있으면 나중에 저장한 쪽을 쓴다
//  · 끝낸 차시 표시(✓)는 양쪽을 합친다

/** 비어 있는 값인가 (빈 글자·빈 목록·빈 꾸러미) */
export function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** 값 하나를 합친다 (newer = 나중에 저장된 쪽) */
export function mergeValue(newer, older) {
  if (isEmpty(newer)) return isEmpty(older) ? newer : older;
  if (isEmpty(older)) return newer;

  // 꾸러미(profile, answers, done ...)는 안쪽 칸까지 하나하나 합친다
  if (isPlainObject(newer) && isPlainObject(older)) {
    const out = { ...older };
    for (const k of Object.keys(newer)) out[k] = mergeValue(newer[k], older[k]);
    return out;
  }

  // 목록(items 등)은 반씩 섞으면 오히려 이상해지므로 나중 것을 통째로 쓴다
  return newer;
}

/**
 * 저장해 둔 내용 두 벌을 합친다.
 * @param {object} a 한쪽 (서버에 있던 것)
 * @param {object} b 다른 쪽 (이 브라우저에 있던 것)
 */
export function mergeData(a, b) {
  const A = a && typeof a === 'object' ? a : {};
  const B = b && typeof b === 'object' ? b : {};
  const ta = Date.parse(A.savedAt || '') || 0;
  const tb = Date.parse(B.savedAt || '') || 0;
  const newer = ta >= tb ? A : B;
  const older = ta >= tb ? B : A;

  const merged = mergeValue({ ...newer }, { ...older });
  merged.savedAt = newer.savedAt || older.savedAt;
  return merged;
}

/** 실제 내용이 얼마나 들어 있는지 (저장 시각은 내용으로 치지 않는다) */
export function contentSize(data) {
  if (!data || typeof data !== 'object') return 0;
  const { savedAt, ...rest } = data;
  let n = 0;
  for (const v of Object.values(rest)) {
    if (!isEmpty(v)) n += JSON.stringify(v).length;
  }
  return n;
}
