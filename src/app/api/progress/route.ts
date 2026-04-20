import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { parseToken } from '@/app/api/auth/route';

/** GET /api/progress — 获取玩家所有游览进度 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('player_progress')
    .select('destination_slug, visited_place_ids, updated_at')
    .eq('player_id', playerId);

  if (error) {
    console.error('[/api/progress] 查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }

  // 转换为 { [slug]: { visitedPlaceIds, updatedAt } } 格式
  const progress: Record<string, { visitedPlaceIds: string[]; updatedAt: string }> = {};
  for (const row of data ?? []) {
    progress[row.destination_slug] = {
      visitedPlaceIds: row.visited_place_ids ?? [],
      updatedAt: row.updated_at,
    };
  }

  return NextResponse.json({ progress });
}

/** POST /api/progress — 更新某个目的地的游览进度 */
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const { destinationSlug, visitedPlaceIds } = await request.json();

  if (!destinationSlug || !Array.isArray(visitedPlaceIds)) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from('player_progress')
    .upsert(
      {
        player_id: playerId,
        destination_slug: destinationSlug,
        visited_place_ids: visitedPlaceIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,destination_slug' }
    );

  if (error) {
    console.error('[/api/progress] 写入失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
