import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getCachedInfo, setCachedInfo } from '@/lib/destination-cache';

export async function POST(request: NextRequest) {
  try {
    const { destinationId, destinationName } = await request.json();

    if (!destinationId || typeof destinationId !== 'string') {
      return NextResponse.json({ error: '请提供目的地 ID' }, { status: 400 });
    }

    if (!destinationName || typeof destinationName !== 'string') {
      return NextResponse.json({ error: '请提供目的地名称' }, { status: 400 });
    }

    // 1. 先查缓存，命中则直接返回
    const cached = getCachedInfo(destinationId);
    if (cached) {
      return NextResponse.json({ info: cached, fromCache: true });
    }

    // 2. 未缓存，通过 web-search 获取
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const searchClient = new SearchClient(config, customHeaders);

    // 搜索目的地关键词和评价
    const searchResponse = await searchClient.webSearch(
      `${destinationName} 旅游 关键词 特点 游客评价`,
      5,
      true // 需要 AI 摘要
    );

    // 3. 从搜索结果提取关键词和评价
    const keywords: string[] = [];
    const reviews: string[] = [];
    const seenKeywords = new Set<string>();

    if (searchResponse.web_items) {
      for (const item of searchResponse.web_items) {
        // 从 snippet 中提取关键词
        if (item.snippet) {
          const snippetKeywords = extractKeywords(item.snippet, destinationName);
          for (const kw of snippetKeywords) {
            if (!seenKeywords.has(kw)) {
              seenKeywords.add(kw);
              keywords.push(kw);
            }
          }
          reviews.push(item.snippet.slice(0, 100));
        }
      }
    }

    // 使用 AI 摘要作为 summary
    const summary = searchResponse.summary ?? `${destinationName}旅游目的地`;

    // 限制关键词数量
    const info = {
      id: destinationId,
      keywords: keywords.slice(0, 10),
      reviews: reviews.slice(0, 5),
      summary,
    };

    // 4. 写入缓存
    setCachedInfo(info);

    return NextResponse.json({ info, fromCache: false });
  } catch (error) {
    console.error('[/api/destination/info] 获取目的地信息失败:', error);
    return NextResponse.json(
      { error: '获取目的地信息失败' },
      { status: 500 }
    );
  }
}

/**
 * 从文本中提取关键词（简易中文分词）
 * 提取 2-4 字的常见旅游相关词汇
 */
function extractKeywords(text: string, destName: string): string[] {
  const patterns = [
    /[古今][镇城村]/g,
    /[东西南北][栅庄街巷]/g,
    /水乡/g,
    /古镇/g,
    /园林/g,
    /山[峰岭脉]/g,
    /湖[泊光畔]/g,
    /夜[景色游]/g,
    /风[景光情]标?/g,
    /文[化物人]/g,
    /历[史代]/g,
    /桥[梁头]/g,
    /河[道流畔]/g,
    /民[俗居间]/g,
    /花[海田开]/g,
    /雪[山景景]/g,
    /[温冷矿]泉/g,
    /竹[林海]/g,
    /烟[雨雾]/g,
    /渔[村家船]/g,
    /[建寺观庙]筑?/g,
    /石[板桥巷]/g,
    /茶[园馆道]/g,
  ];

  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (m !== destName && !results.includes(m)) {
          results.push(m);
        }
      }
    }
  }

  return results;
}
