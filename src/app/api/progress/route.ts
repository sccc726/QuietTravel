import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { parseToken } from '@/app/api/auth/route';

/** GET /api/progress — 获取玩家所有游览进度（含 touring_state） */
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('player_progress')
    .select('destination_slug, visited_place_ids, total_places, updated_at, touring_state')
    .eq('player_id', playerId);

  if (error) {
    console.error('[/api/progress] 查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }

  // 转换为 { [slug]: { visitedPlaceIds, totalPlaces, updatedAt, touringState } } 格式
  const progress: Record<string, {
    visitedPlaceIds: string[];
    totalPlaces: number;
    updatedAt: string;
    touringState: Record<string, unknown> | null;
  }> = {};
  for (const row of data ?? []) {
    progress[row.destination_slug] = {
      visitedPlaceIds: row.visited_place_ids ?? [],
      totalPlaces: row.total_places ?? 0,
      updatedAt: row.updated_at,
      touringState: row.touring_state ?? null,
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

  const { destinationSlug, visitedPlaceIds, totalPlaces, touringState } = await request.json();

  if (!destinationSlug || !Array.isArray(visitedPlaceIds)) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const client = getSupabaseClient();

  const upsertData: Record<string, unknown> = {
    player_id: playerId,
    destination_slug: destinationSlug,
    visited_place_ids: visitedPlaceIds,
    total_places: totalPlaces ?? 0,
    updated_at: new Date().toISOString(),
  };
  // 只有显式传入 touringState 时才更新该字段
  if (touringState !== undefined) {
    upsertData.touring_state = touringState;
  }

  const { error } = await client
    .from('player_progress')
    .upsert(upsertData, { onConflict: 'player_id,destination_slug' });

  if (error) {
    console.error('[/api/progress] 写入失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** PATCH /api/progress — 仅更新 touring_state（轻量接口） */
export async function PATCH(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const playerId = parseToken(token);
  if (!playerId) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

  const { destinationSlug, touringState } = await request.json();

  if (!destinationSlug) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  const client = getSupabaseClient();

  if (touringState === null) {
    // 清除游览状态
    const { error } = await client
      .from('player_progress')
      .update({ touring_state: null, updated_at: new Date().toISOString() })
      .eq('player_id', playerId)
      .eq('destination_slug', destinationSlug);

    if (error) {
      console.error('[/api/progress PATCH] 清除 touring_state 失败:', error);
      return NextResponse.json({ error: '保存失败' }, { status: 500 });
    }
  } else {
    // 更新游览状态（upsert 以防记录不存在）
    const { error } = await client
      .from('player_progress')
      .upsert(
        {
          player_id: playerId,
          destination_slug: destinationSlug,
          touring_state: touringState,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'player_id,destination_slug' }
      );

    if (error) {
      console.error('[/api/progress PATCH] 写入 touring_state 失败:', error);
      return NextResponse.json({ error: '保存失败' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
