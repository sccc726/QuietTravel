import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { parseToken } from '@/app/api/auth/route';

/** GET /api/destinations — 获取玩家所有已保存的目的地 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('player_destinations')
    .select('destination_slug, destination_name, lat, lng, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[/api/destinations GET] 查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }

  // 转换为前端 Destination 格式
  const destinations = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.destination_slug as string,
    name: row.destination_name as string,
    lat: row.lat as number,
    lng: row.lng as number,
  }));

  return NextResponse.json({ destinations });
}

/** POST /api/destinations — 保存一个目的地（upsert） */
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const { destinationSlug, destinationName, lat, lng } = await request.json();

  if (!destinationSlug || !destinationName || lat == null || lng == null) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from('player_destinations')
    .upsert(
      {
        player_id: playerId,
        destination_slug: destinationSlug,
        destination_name: destinationName,
        lat,
        lng,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,destination_slug' },
    );

  if (error) {
    console.error('[/api/destinations POST] 写入失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
