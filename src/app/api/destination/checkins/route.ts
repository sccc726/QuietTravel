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

    // 2. 多轮搜索，分别搜索不同类型的打卡地，提升搜索质量
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const searchClient = new SearchClient(config, customHeaders);

    const [res1, res2, res3] = await Promise.allSettled([
      searchClient.webSearch(
        `${dest.name} 特色餐厅 美食推荐 地址`,
        8,
        true
      ),
      searchClient.webSearch(
        `${dest.name} 咖啡厅 酒吧 茶馆 地址`,
        8,
        true
      ),
      searchClient.webSearch(
        `${dest.name} 网红出片 拍照 打卡 地址 店名`,
        8,
        true
      ),
    ]);

    // 合并搜索结果
    const allItems: Array<{ title: string; snippet: string }> = [];
    for (const res of [res1, res2, res3]) {
      if (res.status === 'fulfilled' && res.value.web_items) {
        for (const item of res.value.web_items) {
          allItems.push({
            title: item.title ?? '',
            snippet: item.snippet ?? '',
          });
        }
      }
    }

    // 3. 用 LLM 从搜索结果中结构化提取打卡地列表
    const searchContext = allItems
      .slice(0, 24) // 限制输入长度
      .map((item, i) => `[${i + 1}] ${item.title}: ${item.snippet}`)
      .join('\n');

    const llmClient = new LLMClient(config, customHeaders);
    const llmResponse = await llmClient.invoke(
      [
        {
          role: 'system' as const,
          content: `你是一个旅游数据提取助手。根据搜索结果，提取该目的地的具体打卡地（包括餐厅、酒吧、咖啡厅、茶馆、网红出片点等）。

重要规则：
- name 必须是具体的店名/地点名，如"似水年华红酒坊""草木本色染坊""水市口茶馆"，绝不能是文章标题
- 如果搜索结果只提到了类别没有具体店名，跳过该条
- 从文章标题和正文中推断出提到的具体店名、地名

返回严格的 JSON 数组，每个元素包含：
- name: 打卡地具体名称，2-8字（string）
- description: 一句话简介，15字以内（string）
- tag: 类型标签，从"餐厅""咖啡馆""茶馆""酒吧""出片点""甜品店""文创店"中选择（string）
- keywords: 关键词数组，6个，描述该地点特色（string[]）
- reviews: 游客评价摘要数组，3条，每条20字以内，基于搜索内容合理推断（string[]）

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
          checkins = parsed
            .map((item: Record<string, unknown>, idx: number) => ({
              id: `${destinationId}-checkin-${idx + 1}`,
              name: String(item.name ?? ''),
              description: String(item.description ?? ''),
              tag: item.tag ? String(item.tag) : undefined,
              type: 'checkin' as const,
              keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
              reviews: Array.isArray(item.reviews) ? item.reviews.map(String) : [],
            }))
            .filter(p => p.name.length > 0 && p.name.length <= 12);
        }
      }
    } catch (parseErr) {
      console.error('[/api/destination/checkins] JSON 解析失败:', parseErr);
    }

    // 5. 降级：二次尝试用 LLM 直接根据目的地知识生成
    if (checkins.length === 0) {
      try {
        const fallbackResponse = await llmClient.invoke(
          [
            {
              role: 'system' as const,
              content: `你是一个旅游数据专家。请根据你对${dest.name}的了解，列出该地的知名打卡地（餐厅、酒吧、咖啡厅、茶馆、网红出片点等）。

返回严格的 JSON 数组，每个元素包含：
- name: 打卡地具体名称，2-8字（string）
- description: 一句话简介，15字以内（string）
- tag: 类型标签，从"餐厅""咖啡馆""茶馆""酒吧""出片点""甜品店""文创店"中选择（string）
- keywords: 关键词数组，6个（string[]）
- reviews: 游客评价摘要数组，3条，每条20字以内（string[]）

列出 6-8 个。只返回 JSON 数组。`,
            },
            {
              role: 'user' as const,
              content: `请列出${dest.name}的知名打卡地。`,
            },
          ],
          {
            model: 'doubao-seed-2-0-lite-260215',
            temperature: 0.3,
            thinking: 'disabled',
          }
        );
        const raw = fallbackResponse.content.trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            checkins = parsed
              .map((item: Record<string, unknown>, idx: number) => ({
                id: `${destinationId}-checkin-${idx + 1}`,
                name: String(item.name ?? ''),
                description: String(item.description ?? ''),
                tag: item.tag ? String(item.tag) : undefined,
                type: 'checkin' as const,
                keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
                reviews: Array.isArray(item.reviews) ? item.reviews.map(String) : [],
              }))
              .filter(p => p.name.length > 0 && p.name.length <= 12);
          }
        }
      } catch (fallbackErr) {
        console.error('[/api/destination/checkins] 降级 LLM 也失败:', fallbackErr);
      }
    }

    const result = { id: destinationId, checkins };

    // 6. 写入缓存
    setCachedCheckins(result);

    return NextResponse.json({ data: result, fromCache: false });
  } catch (error) {
    console.error('[/api/destination/checkins] 获取打卡地失败:', error);
    return NextResponse.json({ error: '获取打卡地信息失败' }, { status: 500 });
  }
}
