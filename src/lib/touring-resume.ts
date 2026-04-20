/** 游览状态恢复工具 */

import { authHeaders } from './auth';

/** 游览状态（与 touring page 的 TouringState 保持一致） */
interface TouringState {
  destinationId: string;
  destinationName: string;
  placeId: string;
  totalEvents: number;
  completedEvents: number;
  timerStartAt: number;
  intervalMs: number;
  hasImage: boolean;
  totalPlaces: number;
  lastSavedAt: number;
}

/** 最大恢复时间（4小时），超过视为游览结束 */
const MAX_RECOVERY_MS = 4 * 60 * 60 * 1000;

/** 检查是否有活跃的游览状态，返回跳转 URL 或 null */
export async function checkActiveTouring(): Promise<string | null> {
  try {
    const res = await fetch('/api/progress', { headers: authHeaders() });
    const data = await res.json();
    if (!data.progress) return null;

    // 查找所有有活跃 touringState 的目的地，选最近保存的
    let latestState: TouringState | null = null;
    let latestSlug = '';

    for (const [slug, info] of Object.entries(data.progress as Record<string, { touringState: TouringState | null }>)) {
      const state = info.touringState;
      if (!state || !state.destinationId || !state.placeId) continue;

      // 检查是否过期（超过4小时）
      const elapsed = Date.now() - state.timerStartAt;
      if (elapsed > MAX_RECOVERY_MS) continue;

      if (!latestState || state.lastSavedAt > latestState.lastSavedAt) {
        latestState = state;
        latestSlug = slug;
      }
    }

    if (!latestState || !latestSlug) return null;

    // 构造游览页 URL
    const params = new URLSearchParams({
      destinationId: latestState.destinationId,
      name: latestState.destinationName,
      placeId: latestState.placeId,
      events: String(latestState.totalEvents),
      total: String(latestState.totalPlaces),
    });

    return `/visit/touring?${params.toString()}`;
  } catch {
    return null;
  }
}
