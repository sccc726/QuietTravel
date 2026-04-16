import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedAttractions, getCachedCheckins } from '@/lib/destination-cache';

export async function POST(request: NextRequest) {
  try {
    const { destinationId, destinationName, placeId, previousEvents } = await request.json();

    if (!destinationId || !placeId) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 });
    }

    // 从缓存中查找当前地点的详细信息
    const isCheckin = placeId.includes('-checkin-');
    const cachedData = isCheckin
      ? getCachedCheckins(destinationId)
      : getCachedAttractions(destinationId);

    let placeInfo: { name: string; description: string; keywords: string[]; reviews: string[] } = {
      name: '',
      description: '',
      keywords: [],
      reviews: [],
    };

    if (cachedData) {
      const list: Array<{ name: string; description: string; keywords: string[]; reviews: string[]; id?: string }> =
        isCheckin
          ? (cachedData as import('@/lib/destinations').DestinationCheckins).checkins
          : (cachedData as import('@/lib/destinations').DestinationAttractions).attractions;
      const found = list.find((p: { id?: string }) => p.id === placeId);
      if (found) {
        placeInfo = found;
      }
    }

    // 构建上下文
    const contextParts: string[] = [];
    if (destinationName) {
      contextParts.push(`目的地：${destinationName}`);
    }
    if (placeInfo.name) {
      contextParts.push(`当前地点：${placeInfo.name}`);
    }
    if (placeInfo.description) {
      contextParts.push(`地点简介：${placeInfo.description}`);
    }
    if (placeInfo.keywords.length > 0) {
      contextParts.push(`关键词：${placeInfo.keywords.join('、')}`);
    }
    if (placeInfo.reviews.length > 0) {
      contextParts.push(`游客评价：${placeInfo.reviews.join('；')}`);
    }
    if (previousEvents && previousEvents.length > 0) {
      contextParts.push(`之前已发生的事件：\n${previousEvents.map((e: string, i: number) => `${i + 1}. ${e}`).join('\n')}`);
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      {
        role: 'system' as const,
        content:
          '你是一位安静的旅行叙事者。为玩家描述在旅途中遇到的一个随机事件，以第二人称"你"来叙述。风格宁静、文艺、沉浸，50~100字之间。像是在写一段旅行日记，不是用感叹号，而是用安静的语调记录旅途中的小发现。可以是看到某处风景、遇见某个人、品尝某种食物、听见某段声音、发现某个细节。事件要和当前地点的氛围相关。直接输出事件文本，不要加引号或编号。',
      },
      {
        role: 'user' as const,
        content: `请为以下旅行场景生成一个随机事件：\n${contextParts.join('\n')}`,
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 1.4,
      thinking: 'disabled',
    });

    const eventText = response.content.trim();

    // 70% 概率生成彩色水墨风格图片
    let imageUrl: string | undefined;
    if (Math.random() < 0.7) {
      try {
        const imgClient = new ImageGenerationClient(config, customHeaders);
        const imgResponse = await imgClient.generate({
          prompt: `旅行风景摄影照片，${eventText}，${destinationName ?? '旅途'}。真实自然光影，水墨画风格滤镜叠加，宁静氛围，柔和淡雅色调，如梦似幻的安静感，不要出现任务面部`,
          size: '1K',
          watermark: false,
        });
        const helper = imgClient.getResponseHelper(imgResponse);
        if (helper.success && helper.imageUrls.length > 0) {
          imageUrl = helper.imageUrls[0];
        }
      } catch (imgErr) {
        console.error('[/api/visit/event] 图片生成失败:', imgErr);
        // 图片生成失败不影响事件文本返回
      }
    }

    return NextResponse.json({ event: eventText, imageUrl });
  } catch (error) {
    console.error('[/api/visit/event] 生成事件失败:', error);
    return NextResponse.json(
      { event: '你沿着小路慢慢走着，光影从树叶间洒落，风里带着淡淡的花香。这一刻，什么都不用想。' },
      { status: 200 }
    );
  }
}
