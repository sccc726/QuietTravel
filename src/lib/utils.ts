import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 安全解析 LLM 输出的 JSON 数组
 * - 先提取 [...] 部分
 * - 修复常见的 LLM JSON 格式问题：中文引号、尾部逗号、单引号、注释等
 * - 解析失败返回 null
 */
export function safeParseLLMJsonArray(raw: string): unknown[] | null {
  try {
    // 提取第一个 [...] 块
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;

    let json = match[0];

    // 1. 中文引号 → 英文引号
    json = json.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");

    // 2. 移除 JS 风格注释 (// ... 和 /* ... */)
    json = json.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // 3. 对象/数组末尾多余的逗号 (,] 或 ,})
    json = json.replace(/,\s*([}\]])/g, '$1');

    // 4. 单引号属性名/值 → 双引号（简易处理）
    //    仅处理 key: 'value' 和 'key': 模式
    json = json.replace(/'([^']*)'(\s*:)/g, '"$1"$2'); // key
    json = json.replace(/:\s*'([^']*)'/g, ': "$1"');    // string value

    // 5. 尝试解析
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;

    return null;
  } catch {
    // 最终兜底：逐层尝试截断修复
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return null;
      let json = match[0];

      // 尝试从末尾逐步回退，找到最后一个完整的 }
      for (let i = json.length - 1; i >= 0; i--) {
        if (json[i] === '}') {
          const truncated = json.slice(0, i + 1) + ']';
          try {
            const parsed = JSON.parse(truncated);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch {
            continue;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}
