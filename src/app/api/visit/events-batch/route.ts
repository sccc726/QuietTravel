import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedAttractions, getCachedCheckins } from '@/lib/destination-cache';
import { safeParseLLMJsonArray } from '@/lib/utils';
import { TimeSlot, timeSlotName, timeSlotDescription, getUpcomingSlots } from '@/lib/destinations';

/** POST /api/visit/events-batch — 批量生成多条随机事件（1 次 LLM 调用） */
export async function POST(request: NextRequest) {
  try {
    const { destinationId, destinationName, placeId, count, hasImage, timeSlot } = await request.json();
    if (!destinationId || !placeId || !count || count < 1) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 获取地点信息
    const isCheckin = placeId.includes('-checkin-');
    const cachedData = await (isCheckin
      ? getCachedCheckins(destinationId)
      : getCachedAttractions(destinationId));

    let placeName = destinationName ?? '未知地点';
    let placeDesc = '';
    if (cachedData) {
      const list = isCheckin
        ? (cachedData as import('@/lib/destinations').DestinationCheckins).checkins
        : (cachedData as import('@/lib/destinations').DestinationAttractions).attractions;
      const found = list?.find((p: { id?: string }) => p.id === placeId);
      if (found) {
        placeName = found.name;
        placeDesc = found.description ?? '';
      }
    }

    // 构建时间段描述
    let timeSlotDesc = '';
    if (timeSlot !== undefined && timeSlot !== null) {
      const slots = getUpcomingSlots(timeSlot as TimeSlot, count as number);
      timeSlotDesc = `\n各事件时段：${slots.map((s, i) => `第${i + 1}条-${timeSlotName(s)}（${timeSlotDescription(s)}）`).join('；')}`;
    }

    // 批量生成 N 条事件（1 次 LLM 调用）
    const messages = [
      {
        role: 'system' as const,
        content: `你是一个旅行随笔作家，为游戏"别处"生成旅途中的随机见闻。每次生成${count}条独立的小见闻，每条50-100字。
要求：
- 每条见闻描写不同的场景或感受
- 风格安静、有画面感、带一点诗意
- 偶尔提及当地的细节（食物、声音、气味等）
- 不要重复场景
- 各条见闻要符合对应时段的氛围（如清晨安静、中午热闹、晚上灯光）
- 严格返回 JSON 数组，每个元素是一个字符串（见闻文本）
- 只返回 JSON 数组，不要其他文字`,
      },
      {
        role: 'user' as const,
        content: `目的地：${destinationName ?? '某处'}
地点：${placeName}
${placeDesc ? `地点简介：${placeDesc}` : ''}${timeSlotDesc}
请生成 ${count} 条旅途见闻。`,
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 1.4,
      thinking: 'disabled',
    });

    // 解析返回的事件列表
    const raw = response.content.trim();
    let events: string[] = [];
    const parsed = safeParseLLMJsonArray(raw);
    if (parsed && parsed.length > 0) {
      events = parsed.filter((e: unknown) => typeof e === 'string' && (e as string).length > 0)
        .map((e: unknown) => {
          let s = (e as string).trim();
          // 清除首尾多余的引号和逗号
          if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
          if (s.endsWith(',')) s = s.slice(0, -1);
          return s.trim();
        })
        .filter(s => s.length > 0) as string[];
    } else {
      // 降级：按换行分割
      events = raw.split('\n')
        .filter(l => l.trim().length > 10)
        .map(l => {
          let s = l.replace(/^\d+[\.\)、]\s*/, '').trim();
          if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
          if (s.endsWith(',')) s = s.slice(0, -1);
          return s.trim();
        })
        .filter(s => s.length > 0);
    }

    // 不足则补充
    while (events.length < count) {
      events.push('你沿着小路慢慢走着，光影从树叶间洒落，风里带着淡淡的花香。这一刻，什么都不用想。');
    }

    // 截取所需数量
    events = events.slice(0, count);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[/api/visit/events-batch] 批量生成失败:', error);
    return NextResponse.json(
      { events: ['你沿着小路慢慢走着，光影从树叶间洒落，风里带着淡淡的花香。'] },
      { status: 200 }
    );
  }
}
