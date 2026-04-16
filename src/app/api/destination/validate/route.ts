import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/** 验证结果类型 */
interface ValidateSuggestion {
  name: string;
  lat: number;
  lng: number;
  brief: string;
}

interface ValidateResult {
  valid: boolean;
  scope?: 'too_narrow' | 'too_broad' | 'not_found';
  hint?: string;
  name?: string;
  lat?: number;
  lng?: number;
  brief?: string;
  suggestion?: ValidateSuggestion;
  suggestions?: ValidateSuggestion[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = String(body.query ?? '').trim();

    if (!query) {
      return NextResponse.json({ error: '请输入目的地' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();

    // 1. web-search 获取该地点的基本信息
    const searchClient = new SearchClient(config, customHeaders);
    const searchResult = await searchClient.webSearch(
      `${query} 旅游 景点 攻略`,
      6,
      true
    );

    const searchItems = searchResult.web_items ?? [];
    const searchContext = searchItems
      .slice(0, 8)
      .map((item, i) => `[${i + 1}] ${item.title ?? ''}: ${item.snippet ?? ''}`)
      .join('\n');

    // 2. LLM 判断尺度并校准
    const llmClient = new LLMClient(config, customHeaders);
    const llmResponse = await llmClient.invoke(
      [
        {
          role: 'system' as const,
          content: `你是一个旅游目的地校准助手。玩家输入了一个想去的地点名称，你需要判断这个地点的尺度是否适合作为一次旅游的目的地。

适合的尺度 = 该范围内有大约 7-10 个值得一去的景点和打卡地（包括餐厅、咖啡馆、网红出片点等）。

判断规则：
- 太窄（scope: "too_narrow"）：如"夫子庙""西栅""外滩"，只是一个景点或街区，无法撑起 7-10 个值得去的地方。应建议扩大到一个合适的上级区域（如"南京""上海"）
- 太宽（scope: "too_broad"）：如"江苏省""长三角""中国"，范围太大，建议缩小到 2-3 个具体城市
- 不存在（scope: "not_found"）：不是真实存在的国内地点，或不是旅游目的地
- 合适（scope: "ok"）：如"乌镇""丽江""张家界""西安""厦门"，人们会说"去XX旅游"的地方

重要：目的地必须在中国境内。境外地点返回 not_found。

返回严格的 JSON 对象：
- 合适：{ "scope": "ok", "name": "地名", "lat": 纬度, "lng": 经度, "brief": "一句话简介10字以内" }
- 太窄：{ "scope": "too_narrow", "hint": "提示语", "suggestion": { "name": "建议地名", "lat": 纬度, "lng": 经度, "brief": "一句话简介" } }
- 太宽：{ "scope": "too_broad", "hint": "提示语", "suggestions": [{ "name": "建议1", "lat": 纬度, "lng": 经度, "brief": "简介" }, ...] }
- 不存在：{ "scope": "not_found", "hint": "提示语" }

坐标要求：使用真实的地理坐标（WGS84），精确到小数点后4位。只返回 JSON，不要其他文字。`,
        },
        {
          role: 'user' as const,
          content: `玩家输入："${query}"\n\n搜索结果：\n${searchContext || '无搜索结果'}`,
        },
      ],
      {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.2,
        thinking: 'disabled',
      }
    );

    // 3. 解析 LLM 返回
    let result: ValidateResult = { valid: false, scope: 'not_found', hint: '未找到该目的地' };

    try {
      const raw = llmResponse.content.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        const scope = String(parsed.scope ?? 'not_found');

        if (scope === 'ok') {
          result = {
            valid: true,
            name: String(parsed.name ?? query),
            lat: Number(parsed.lat),
            lng: Number(parsed.lng),
            brief: String(parsed.brief ?? ''),
          };
          // 校验坐标合理性（中国境内大致范围）
          if (result.lat! < 18 || result.lat! > 54 || result.lng! < 73 || result.lng! > 135) {
            result = { valid: false, scope: 'not_found', hint: '该目的地不在国内' };
          }
        } else if (scope === 'too_narrow' && parsed.suggestion) {
          const s = parsed.suggestion as Record<string, unknown>;
          result = {
            valid: false,
            scope: 'too_narrow',
            hint: String(parsed.hint ?? '范围太小'),
            suggestion: {
              name: String(s.name ?? ''),
              lat: Number(s.lat),
              lng: Number(s.lng),
              brief: String(s.brief ?? ''),
            },
          };
        } else if (scope === 'too_broad' && Array.isArray(parsed.suggestions)) {
          result = {
            valid: false,
            scope: 'too_broad',
            hint: String(parsed.hint ?? '范围太大'),
            suggestions: (parsed.suggestions as Record<string, unknown>[]).map(s => ({
              name: String(s.name ?? ''),
              lat: Number(s.lat),
              lng: Number(s.lng),
              brief: String(s.brief ?? ''),
            })),
          };
        } else {
          result = { valid: false, scope: 'not_found', hint: String(parsed.hint ?? '未找到该目的地') };
        }
      }
    } catch (parseErr) {
      console.error('[/api/destination/validate] JSON 解析失败:', parseErr);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/destination/validate] 验证失败:', error);
    return NextResponse.json(
      { valid: false, scope: 'not_found', hint: '验证失败，请重试' } as ValidateResult,
      { status: 200 }
    );
  }
}
