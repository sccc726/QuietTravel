import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedInfo } from '@/lib/destination-cache';

export async function POST(request: NextRequest) {
  let destinationId = '';
  let destinationName = '';

  try {
    const body = await request.json();
    destinationId = body.destinationId ?? '';
    destinationName = body.destinationName ?? '';

    if (!destinationId) {
      return NextResponse.json({ error: '请提供目的地 ID' }, { status: 400 });
    }

    // 如果没传 destinationName，从缓存信息中尝试获取
    if (!destinationName) {
      const cachedInfo = getCachedInfo(destinationId);
      if (cachedInfo) {
        destinationName = cachedInfo.summary ? destinationId : '';
      }
    }

    // 从缓存获取关键词信息
    const cachedInfo = getCachedInfo(destinationId);

    // 构建上下文：有缓存则用关键词，没有则用名称
    const contextParts: string[] = [];
    if (destinationName) {
      contextParts.push(`目的地名称：${destinationName}`);
    }

    if (cachedInfo) {
      if (cachedInfo.keywords.length > 0) {
        contextParts.push(`关键词：${cachedInfo.keywords.join('、')}`);
      }
      if (cachedInfo.summary) {
        contextParts.push(`概况：${cachedInfo.summary}`);
      }
    }

    if (contextParts.length === 0) {
      return NextResponse.json({ description: '一段安静的旅途' });
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
    return NextResponse.json({
      description: '一段安静的旅途',
    });
  }
}
