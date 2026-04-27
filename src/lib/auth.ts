/** 前端认证工具 */

const AUTH_KEY = 'elsewhere-auth';

interface AuthData {
  token: string;
  playerId: number;
  username: string;
  gameDay?: number;
  gameTimeSlot?: number;
}

/** 读取本地存储的认证信息 */
export function getStoredAuth(): AuthData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 保存认证信息到本地 */
export function storeAuth(data: AuthData) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

/** 清除认证信息 */
export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

/** 获取 Authorization header（用于 fetch 调用） */
export function authHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  if (!auth) return {};
  return { Authorization: `Bearer ${auth.token}` };
}

/** 从本地缓存读取游戏时间（避免页面切换时闪烁） */
export function getCachedGameTime(): { gameDay: number; gameTimeSlot: number } {
  const auth = getStoredAuth();
  return {
    gameDay: auth?.gameDay ?? 1,
    gameTimeSlot: auth?.gameTimeSlot ?? 1,
  };
}

/** 更新本地缓存的游戏时间 */
export function cacheGameTime(gameDay: number, gameTimeSlot: number) {
  const auth = getStoredAuth();
  if (auth) {
    auth.gameDay = gameDay;
    auth.gameTimeSlot = gameTimeSlot;
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  }
}

/** 检查是否已登录，未登录则跳转首页 */
export function requireAuth(): AuthData | null {
  return getStoredAuth();
}
