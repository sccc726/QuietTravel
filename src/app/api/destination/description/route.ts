import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedInfo } from '@/lib/destination-cache';
import { destinations } from '@/lib/destinations';

export async function POST(request: NextRequest) {
  let destinationId = '';

  try {
    const body = await request.json();
    destinationId = body.destinationId ?? '';

    if (!destinationId) {
      return NextResponse.json({ error: '请提供目的地 ID' }, { status: 400 });
    }

    const dest = destinations.find(d => d.id === destinationId);
    if (!dest) {
      return NextResponse.json({ error: '目的地不存在' }, { status: 404 });
    }

    // 从缓存获取关键词信息
    const cachedInfo = getCachedInfo(destinationId);

    // 构建上下文：有缓存则用关键词，没有则用静态描述
    const contextParts: string[] = [`目的地名称：${dest.name}`];

    if (cachedInfo) {
      if (cachedInfo.keywords.length > 0) {
        contextParts.push(`关键词：${cachedInfo.keywords.join('、')}`);
      }
      if (cachedInfo.summary) {
        contextParts.push(`概况：${cachedInfo.summary}`);
      }
    } else {
      contextParts.push(`简介：${dest.description}`);
    }

    const contextStr = contextParts.join('\n');

    // 调用 LLM 生成短描述
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      {
        role: 'system' as const,
        content:
          '你是一位安静的旅行诗人。根据提供的目的地信息，写一句约20字的短描述，风格宁静、文艺、如诗。不使用感叹号，语气轻柔。每次都要写不同的文案。直接输出文案，不要加引号或其他格式。',
      },
      {
        role: 'user' as const,
        content: `请为以下目的地写一句短描述：\n${contextStr}`,
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 1.3,
      thinking: 'disabled',
    });

    return NextResponse.json({ description: response.content.trim() });
  } catch (error) {
    console.error('[/api/destination/description] 生成描述失败:', error);
    const dest = destinations.find(d => d.id === destinationId);
    return NextResponse.json({
      description: dest?.description ?? '一段安静的旅途',
    });
  }
}
