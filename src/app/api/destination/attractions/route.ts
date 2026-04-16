import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedAttractions, setCachedAttractions } from '@/lib/destination-cache';
import { safeParseLLMJsonArray } from '@/lib/utils';
import type { PlaceItem } from '@/lib/destinations';

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

    if (!destinationName) {
      return NextResponse.json({ error: '请提供目的地名称' }, { status: 400 });
    }

    // 1. 先查缓存
    const cached = getCachedAttractions(destinationId);
    if (cached) {
      return NextResponse.json({ data: cached, fromCache: true });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();

    // 2. 多轮并行搜索，分别搜索不同维度的景点
    let searchContext = '';
    try {
      const searchClient = new SearchClient(config, customHeaders);
      const [res1, res2, res3] = await Promise.allSettled([
        searchClient.webSearch(`${destinationName} 必去景点 推荐`, 5, true),
        searchClient.webSearch(`${destinationName} 名胜古迹 地标`, 5, true),
        searchClient.webSearch(`${destinationName} 自然风光 公园 寺庙`, 5, true),
      ]);

      const allItems: Array<{ title: string; snippet: string }> = [];
      for (const res of [res1, res2, res3]) {
        if (res.status === 'fulfilled' && res.value.web_items) {
          for (const item of res.value.web_items) {
            allItems.push({ title: item.title ?? '', snippet: item.snippet ?? '' });
          }
        }
      }
      searchContext = allItems
        .slice(0, 18)
        .map((item, i) => `[${i + 1}] ${item.title}: ${item.snippet}`)
        .join('\n');
    } catch (searchErr) {
      console.error('[/api/destination/attractions] web-search 失败:', searchErr);
    }

    // 3. LLM 提取：有搜索结果则提取，没有则直接生成
    const llmClient = new LLMClient(config, customHeaders);
    const hasSearch = searchContext.length > 0;

    const systemPrompt = hasSearch
      ? `你是一个旅游数据提取助手。根据搜索结果，提取该目的地的景点列表。
返回严格的 JSON 数组，每个元素包含：
- name: 景点名称（string）
- description: 一句话简介，15字以内（string）
- tag: 一个简短标签，2字以内（string）
- keywords: 关键词数组，6个（string[]）
- reviews: 游客评价摘要数组，3条，每条20字以内（string[]）

提取 6-8 个最知名的景点。只返回 JSON 数组，不要其他文字。`
      : `你是一个旅游数据专家。请列出${destinationName}的知名景点。
返回严格的 JSON 数组，每个元素包含：
- name: 景点名称（string）
- description: 一句话简介，15字以内（string）
- tag: 一个简短标签，2字以内（string）
- keywords: 关键词数组，6个（string[]）
- reviews: 游客评价摘要数组，3条，每条20字以内（string[]）

列出 6-8 个最知名的景点。只返回 JSON 数组，不要其他文字。`;

    const userContent = hasSearch
      ? `目的地：${destinationName}\n\n搜索结果：\n${searchContext}`
      : `请列出${destinationName}的知名景点。`;

    let attractions: PlaceItem[] = [];

    try {
      const llmResponse = await llmClient.invoke(
        [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userContent },
        ],
        {
          model: 'doubao-seed-2-0-lite-260215',
          temperature: 0.3,
          thinking: 'disabled',
        }
      );

      const raw = llmResponse.content.trim();
      const parsed = safeParseLLMJsonArray(raw);
      if (parsed) {
        attractions = parsed
          .map((item: unknown, idx: number) => {
            const obj = item as Record<string, unknown>;
            return {
              id: `${destinationId}-attr-${idx + 1}`,
              name: String(obj.name ?? ''),
              description: String(obj.description ?? ''),
              tag: obj.tag ? String(obj.tag) : undefined,
              type: 'attraction' as const,
              keywords: Array.isArray(obj.keywords) ? obj.keywords.map(String) : [],
              reviews: Array.isArray(obj.reviews) ? obj.reviews.map(String) : [],
            };
          })
          .filter(p => p.name.length > 0);
      }
    } catch (llmErr) {
      console.error('[/api/destination/attractions] LLM 调用失败:', llmErr);
    }

    // 4. 二次降级：如果仍有数据，直接用 LLM 知识生成
    if (attractions.length === 0) {
      try {
        const fallbackRes = await llmClient.invoke(
          [
            {
              role: 'system' as const,
              content: `你是一个旅游数据专家。请列出${destinationName}的知名景点。返回严格的 JSON 数组，每个元素包含：name(景点名称)、description(一句话简介15字)、tag(2字标签)、keywords(6个关键词)、reviews(3条评价每条20字)。列出 6-8 个。只返回 JSON 数组。`,
            },
            { role: 'user' as const, content: `请列出${destinationName}的知名景点。` },
          ],
          {
            model: 'doubao-seed-2-0-lite-260215',
            temperature: 0.3,
            thinking: 'disabled',
          }
        );
        const raw = fallbackRes.content.trim();
        const parsed = safeParseLLMJsonArray(raw);
        if (parsed) {
          attractions = parsed
            .map((item: unknown, idx: number) => {
              const obj = item as Record<string, unknown>;
              return {
                id: `${destinationId}-attr-${idx + 1}`,
                name: String(obj.name ?? ''),
                description: String(obj.description ?? ''),
                tag: obj.tag ? String(obj.tag) : undefined,
                type: 'attraction' as const,
                keywords: Array.isArray(obj.keywords) ? obj.keywords.map(String) : [],
                reviews: Array.isArray(obj.reviews) ? obj.reviews.map(String) : [],
              };
            })
            .filter(p => p.name.length > 0);
        }
      } catch (fallbackErr) {
        console.error('[/api/destination/attractions] 降级 LLM 也失败:', fallbackErr);
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
