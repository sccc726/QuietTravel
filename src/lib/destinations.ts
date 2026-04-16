/**
 * 赛博旅途 - 目的地与景点数据结构
 *
 * destinations 列表在运行时通过搜索动态创建，初始为空。
 * coordinates: 真实经纬度
 * keywords / reviews: 由 web-search 获取并缓存，只请求一次
 * unlocked / cost: 预留字段，支持后续扩展挂机/经营逻辑
 */

/** 地点类型 */
export type PlaceType = 'attraction' | 'checkin';

/** 基础地点条目 — 景点和打卡地共用 */
export interface PlaceItem {
  id: string;
  name: string;
  /** 一句话简介 */
  description: string;
  /** 标签，如 "水乡" "夜景" "咖啡馆" "网红" */
  tag?: string;
  /** 地点类型 */
  type: PlaceType;
  /** 从搜索结果提取的关键词，供后续生成游记用 */
  keywords: string[];
  /** 游客评价摘要，供后续生成游记用 */
  reviews: string[];
  unlocked?: boolean;
  cost?: number;
}

export interface Destination {
  id: string;
  name: string;
  /** 静态描述，作为降级文案 */
  description: string;
  /** 真实经纬度坐标 */
  coordinates: { lat: number; lng: number };
  /** 旗下的景点列表（静态数据，仅作降级） */
  spots: PlaceItem[];
  /** 是否已解锁，预留字段 */
  unlocked?: boolean;
  /** 解锁消耗，预留字段 */
  cost?: number;
}

/** 目的地扩展信息 — 由 web-search 获取，只请求一次后缓存 */
export interface DestinationInfo {
  id: string;
  /** 从搜索结果提取的关键词标签 */
  keywords: string[];
  /** 游客评价摘要 */
  reviews: string[];
  /** AI 总结的目的地特征 */
  summary: string;
}

/** 目的地景点列表 — 由 web-search 获取并缓存 */
export interface DestinationAttractions {
  id: string;
  attractions: PlaceItem[];
}

/** 目的地打卡地列表 — 由 web-search 获取并缓存 */
export interface DestinationCheckins {
  id: string;
  checkins: PlaceItem[];
}

/**
 * 中文地名 → slug ID 的简易转换
 * 用于生成可读且 URL 安全的目的地 ID
 */
export function destinationSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    // 保留中文、字母、数字、连字符
    .replace(/[^\u4e00-\u9fff\w-]/g, '');
}

/** 预设目的地列表 — 初始为空，目的地由搜索动态创建 */
export const destinations: Destination[] = [];
