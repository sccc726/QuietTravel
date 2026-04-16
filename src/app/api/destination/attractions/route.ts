import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedAttractions, setCachedAttractions } from '@/lib/destination-cache';
import { destinations } from '@/lib/destinations';
import type { PlaceItem } from '@/lib/destinations';

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

    // 1. 先查缓存
    const cached = getCachedAttractions(destinationId);
    if (cached) {
      return NextResponse.json({ data: cached, fromCache: true });
    }

    // 2. web-search 获取景点信息
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const searchClient = new SearchClient(config, customHeaders);

    const searchResponse = await searchClient.webSearch(
      `${dest.name} 必去景点 旅游攻略 推荐`,
      10,
      true
    );

    // 3. 用 LLM 从搜索结果中结构化提取景点列表
    const searchContext = searchResponse.web_items
      ?.map((item, i) => `[${i + 1}] ${item.title ?? ''}: ${item.snippet ?? ''}`)
      .join('\n');

    const llmClient = new LLMClient(config, customHeaders);
    const llmResponse = await llmClient.invoke(
      [
        {
          role: 'system' as const,
          content: `你是一个旅游数据提取助手。根据搜索结果，提取该目的地的景点列表。
返回严格的 JSON 数组，每个元素包含：
- name: 景点名称（string）
- description: 一句话简介，15字以内（string）
- tag: 一个简短标签，2字以内（string）
- keywords: 关键词数组，2-3个（string[]）
- reviews: 游客评价摘要数组，1-2条，每条20字以内（string[]）

提取 6-8 个最知名的景点。只返回 JSON 数组，不要其他文字。`,
        },
        {
          role: 'user' as const,
          content: `目的地：${dest.name}\n\n搜索结果：\n${searchContext}`,
        },
      ],
      {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.3,
        thinking: 'disabled',
      }
    );

    // 4. 解析 LLM 返回的 JSON
    let attractions: PlaceItem[] = [];
    try {
      const raw = llmResponse.content.trim();
      // 尝试提取 JSON 数组部分
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          attractions = parsed.map((item: Record<string, unknown>, idx: number) => ({
            id: `${destinationId}-attr-${idx + 1}`,
            name: String(item.name ?? ''),
            description: String(item.description ?? ''),
            tag: item.tag ? String(item.tag) : undefined,
            keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
            reviews: Array.isArray(item.reviews) ? item.reviews.map(String) : [],
          }));
        }
      }
    } catch (parseErr) {
      console.error('[/api/destination/attractions] JSON 解析失败:', parseErr);
    }

    // 降级：如果 LLM 没有返回有效数据，从搜索结果简单提取
    if (attractions.length === 0 && searchResponse.web_items) {
      const seen = new Set<string>();
      for (const item of searchResponse.web_items) {
        const title = item.title?.replace(/[-_|·].*/, '').trim() ?? '';
        if (title && !seen.has(title) && attractions.length < 8) {
          seen.add(title);
          attractions.push({
            id: `${destinationId}-attr-${attractions.length + 1}`,
            name: title,
            description: item.snippet?.slice(0, 20) ?? '',
            keywords: [],
            reviews: item.snippet ? [item.snippet.slice(0, 30)] : [],
          });
        }
      }
    }

    const result = { id: destinationId, attractions };

    // 5. 写入缓存
    setCachedAttractions(result);

    return NextResponse.json({ data: result, fromCache: false });
  } catch (error) {
    console.error('[/api/destination/attractions] 获取景点失败:', error);
    return NextResponse.json({ error: '获取景点信息失败' }, { status: 500 });
  }
}
