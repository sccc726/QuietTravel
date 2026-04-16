import fs from 'fs';
import path from 'path';
import type { DestinationInfo, DestinationAttractions, DestinationCheckins } from './destinations';

const CACHE_DIR = path.join(process.cwd(), '.cache');

/** 缓存文件映射 */
const CACHE_FILES = {
  info: path.join(CACHE_DIR, 'destination-info.json'),
  attractions: path.join(CACHE_DIR, 'destination-attractions.json'),
  checkins: path.join(CACHE_DIR, 'destination-checkins.json'),
} as const;

type CacheKind = keyof typeof CACHE_FILES;

/** 确保缓存目录存在 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/** 通用缓存读取 */
function readCache<T>(kind: CacheKind): Record<string, T> {
  ensureCacheDir();
  const file = CACHE_FILES[kind];
  if (!fs.existsSync(file)) return {};
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** 通用缓存写入 */
function writeCache<T>(kind: CacheKind, data: Record<string, T>) {
  ensureCacheDir();
  fs.writeFileSync(CACHE_FILES[kind], JSON.stringify(data, null, 2), 'utf-8');
}

/** 通用：获取某条缓存 */
function getCached<T>(kind: CacheKind, id: string): T | null {
  const cache = readCache<T>(kind);
  return cache[id] ?? null;
}

/** 通用：写入某条缓存 */
function setCached<T extends { id: string }>(kind: CacheKind, item: T) {
  const cache = readCache<T>(kind);
  cache[item.id] = item;
  writeCache(kind, cache);
}

export const getCachedInfo = (id: string) => getCached<DestinationInfo>('info', id);
export const setCachedInfo = (item: DestinationInfo) => setCached('info', item);

export const getCachedAttractions = (id: string) => getCached<DestinationAttractions>('attractions', id);
export const setCachedAttractions = (item: DestinationAttractions) => setCached('attractions', item);

export const getCachedCheckins = (id: string) => getCached<DestinationCheckins>('checkins', id);
export const setCachedCheckins = (item: DestinationCheckins) => setCached('checkins', item);
