import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const FALLBACK_GREETINGS = [
  '愿这段旅途如水般温柔，我们慢慢走。',
  '前路漫漫，沿途皆是风景。',
  '风已经准备好了，出发吧。',
  '每一步都是新的故事，慢慢写。',
];

export async function POST(request: NextRequest) {
  let characterName = '旅者';

  try {
    const body = await request.json();
    characterName = body.characterName ?? '旅者';

    if (typeof characterName !== 'string' || characterName.trim() === '') {
      return NextResponse.json(
        { error: '请提供角色名称' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const messages = [
      {
        role: 'system' as const,
        content:
          '你是一位安静的旅行引路人，说话风格宁静、温暖、文艺。每次回复只为旅者写一句问候，50字左右，在开头自然地称呼旅者的名字，表达对旅途的期待。不要使用感叹号，语气轻柔如低语。每次回复都要不同。直接输出文案，不要加引号或其他格式。',
      },
      {
        role: 'user' as const,
        content: `旅者名为「${characterName}」，请为ta写一句旅途启程的问候。`,
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 1.2,
      thinking: 'disabled',
    });

    return NextResponse.json({ greeting: response.content.trim() });
  } catch (error) {
    console.error('[/api/greeting] 生成问候语失败:', error);
    const fallback = FALLBACK_GREETINGS[Math.floor(Math.random() * FALLBACK_GREETINGS.length)];
    return NextResponse.json({ greeting: `${characterName}，${fallback}` });
  }
}
