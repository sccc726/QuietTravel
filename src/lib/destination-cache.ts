import fs from 'fs';
import path from 'path';
import type { DestinationInfo } from './destinations';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'destination-info.json');

/** 确保缓存目录存在 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/** 读取全部缓存 */
function readCache(): Record<string, DestinationInfo> {
  ensureCacheDir();
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** 写入全部缓存 */
function writeCache(data: Record<string, DestinationInfo>) {
  ensureCacheDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** 获取某个目的地的缓存信息，不存在则返回 null */
export function getCachedInfo(id: string): DestinationInfo | null {
  const cache = readCache();
  return cache[id] ?? null;
}

/** 存储某个目的地的信息到缓存 */
export function setCachedInfo(info: DestinationInfo) {
  const cache = readCache();
  cache[info.id] = info;
  writeCache(cache);
}
