import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedCheckins, setCachedCheckins } from '@/lib/destination-cache';
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
    const cached = getCachedCheckins(destinationId);
    if (cached) {
      return NextResponse.json({ data: cached, fromCache: true });
    }

    // 2. web-search 获取打卡地信息
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const searchClient = new SearchClient(config, customHeaders);

    const searchResponse = await searchClient.webSearch(
      `${dest.name} 打卡地 网红 餐厅 咖啡厅 酒吧 出片 推荐`,
      10,
      true
    );

    // 3. 用 LLM 从搜索结果中结构化提取打卡地列表
    const searchContext = searchResponse.web_items
      ?.map((item, i) => `[${i + 1}] ${item.title ?? ''}: ${item.snippet ?? ''}`)
      .join('\n');

    const llmClient = new LLMClient(config, customHeaders);
    const llmResponse = await llmClient.invoke(
      [
        {
          role: 'system' as const,
          content: `你是一个旅游数据提取助手。根据搜索结果，提取该目的地的打卡地列表（包括餐厅、酒吧、咖啡厅、网红出片点等）。
返回严格的 JSON 数组，每个元素包含：
- name: 打卡地名称（string）
- description: 一句话简介，15字以内（string）
- tag: 类型标签，如"餐厅""咖啡馆""出片点""酒吧"（string）
- keywords: 关键词数组，2-3个（string[]）
- reviews: 游客评价摘要数组，1-2条，每条20字以内（string[]）

提取 6-8 个有特色的打卡地。只返回 JSON 数组，不要其他文字。`,
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
    let checkins: PlaceItem[] = [];
    try {
      const raw = llmResponse.content.trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          checkins = parsed.map((item: Record<string, unknown>, idx: number) => ({
            id: `${destinationId}-checkin-${idx + 1}`,
            name: String(item.name ?? ''),
            description: String(item.description ?? ''),
            tag: item.tag ? String(item.tag) : undefined,
            keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
            reviews: Array.isArray(item.reviews) ? item.reviews.map(String) : [],
          }));
        }
      }
    } catch (parseErr) {
      console.error('[/api/destination/checkins] JSON 解析失败:', parseErr);
    }

    // 降级：从搜索结果简单提取
    if (checkins.length === 0 && searchResponse.web_items) {
      const seen = new Set<string>();
      for (const item of searchResponse.web_items) {
        const title = item.title?.replace(/[-_|·].*/, '').trim() ?? '';
        if (title && !seen.has(title) && checkins.length < 8) {
          seen.add(title);
          checkins.push({
            id: `${destinationId}-checkin-${checkins.length + 1}`,
            name: title,
            description: item.snippet?.slice(0, 20) ?? '',
            tag: '打卡地',
            keywords: [],
            reviews: item.snippet ? [item.snippet.slice(0, 30)] : [],
          });
        }
      }
    }

    const result = { id: destinationId, checkins };

    // 5. 写入缓存
    setCachedCheckins(result);

    return NextResponse.json({ data: result, fromCache: false });
  } catch (error) {
    console.error('[/api/destination/checkins] 获取打卡地失败:', error);
    return NextResponse.json({ error: '获取打卡地信息失败' }, { status: 500 });
  }
}
