import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { parseToken } from '@/app/api/auth/route';

/** GET /api/journals — 查询游记记录
 *  ?destinationSlug=xxx&placeId=yyy  → 查某地点的游记（按完成时间倒序）
 *  ?destinationSlug=xxx              → 查某目的地的所有游记
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const destinationSlug = searchParams.get('destinationSlug');
  const placeId = searchParams.get('placeId');

  const client = getSupabaseClient();
  let query = client
    .from('visit_journals')
    .select('id, destination_slug, place_id, place_name, events, has_image, completed_at')
    .eq('player_id', playerId)
    .order('completed_at', { ascending: false });

  if (destinationSlug) {
    query = query.eq('destination_slug', destinationSlug);
  }
  if (placeId) {
    query = query.eq('place_id', placeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[/api/journals GET] 查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }

  return NextResponse.json({ journals: data ?? [] });
}

/** POST /api/journals — 保存一条游记记录 */
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const { destinationSlug, placeId, placeName, events, hasImage } = await request.json();

  if (!destinationSlug || !placeId || !Array.isArray(events)) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from('visit_journals')
    .insert({
      player_id: playerId,
      destination_slug: destinationSlug,
      place_id: placeId,
      place_name: placeName ?? '',
      events,
      has_image: hasImage ?? false,
      completed_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[/api/journals POST] 写入失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
