import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createHash } from 'crypto';

/** 简单密码哈希（安全要求不高，朋友间分享） */
function hashPassword(password: string): string {
  return createHash('sha256').update(`elsewhere-salt:${password}`).digest('hex');
}

/** 生成简单 token（player_id + 时间戳 + 签名） */
function generateToken(playerId: number): string {
  const payload = `${playerId}:${Date.now()}`;
  const sig = createHash('sha256').update(`elsewhere-token:${payload}`).digest('hex').slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

/** 从 token 解析 player_id */
export function parseToken(token: string): number | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const playerId = parseInt(parts[0], 10);
    const timestamp = parts[1];
    const sig = parts[2];
    const expectedSig = createHash('sha256').update(`elsewhere-token:${playerId}:${timestamp}`).digest('hex').slice(0, 16);
    if (sig !== expectedSig) return null;
    // token 有效期 30 天
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > 30 * 24 * 60 * 60 * 1000) return null;
    return playerId;
  } catch {
    return null;
  }
}

/** POST /api/auth — 注册或登录 */
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || typeof username !== 'string' || username.trim().length < 1 || username.trim().length > 20) {
      return NextResponse.json({ error: '角色名需要1-20个字符' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 3 || password.length > 30) {
      return NextResponse.json({ error: '密码需要3-30个字符' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const hashedPwd = hashPassword(password);

    // 查找是否已有该用户名
    const { data: existing } = await client
      .from('players')
      .select('id, password')
      .eq('username', username.trim())
      .maybeSingle();

    if (existing) {
      // 已有用户 — 登录
      if (existing.password !== hashedPwd) {
        return NextResponse.json({ error: '密码不正确' }, { status: 401 });
      }
      const token = generateToken(existing.id);
      // 获取游戏时间和资源
      const { data: playerData } = await client
        .from('players')
        .select('game_day, game_time_slot, money, mood')
        .eq('id', existing.id)
        .single();
      return NextResponse.json({
        ok: true,
        mode: 'login',
        player: { id: existing.id, username: username.trim() },
        token,
        gameDay: playerData?.game_day ?? 1,
        gameTimeSlot: playerData?.game_time_slot ?? 1,
        money: playerData?.money ?? 500,
        mood: playerData?.mood ?? 10,
      });
    } else {
      // 新用户 — 注册
      const { data: newPlayer, error } = await client
        .from('players')
        .insert({ username: username.trim(), password: hashedPwd })
        .select('id, username')
        .single();

      if (error || !newPlayer) {
        return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 });
      }

      const token = generateToken(newPlayer.id);
      return NextResponse.json({
        ok: true,
        mode: 'register',
        player: { id: newPlayer.id, username: newPlayer.username },
        token,
        gameDay: 1,
        gameTimeSlot: 1,
        money: 500,
        mood: 10,
      });
    }
  } catch (error) {
    console.error('[/api/auth] 认证失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
