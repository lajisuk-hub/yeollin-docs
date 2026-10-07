// 무료 Supabase 프로젝트가 일주일 안 쓰면 잠드는 것을 막기 위해 하루 한 번 가볍게 두드린다.
// (vercel.json 의 crons 가 매일 00:00 UTC 에 부른다 — Hobby 요금제도 하루 1회는 무료)
export const dynamic = 'force-dynamic';

export async function GET() {
  const URL_BASE = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SECRET_KEY;
  if (!URL_BASE || !KEY) return Response.json({ ok: false, error: 'no-env' }, { status: 500 });
  try {
    const res = await fetch(`${URL_BASE}/storage/v1/bucket/yeollin`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, cache: 'no-store',
    });
    return Response.json({ ok: res.ok, status: res.status, at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
