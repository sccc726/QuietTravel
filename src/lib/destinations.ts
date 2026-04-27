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

// ===================== 时间系统 =====================

/** 时间段枚举 — 9 个时段 */
export enum TimeSlot {
  dawn = 0,      // 拂晓（预留）
  morning1 = 1,  // 清晨
  morning2 = 2,  // 早上
  morning3 = 3,  // 上午
  noon = 4,      // 中午
  afternoon = 5, // 下午
  evening = 6,   // 傍晚
  night = 7,     // 晚上
  latenight = 8, // 深夜（预留）
}

/** 时段中文名 */
const TIME_SLOT_NAMES: Record<TimeSlot, string> = {
  [TimeSlot.dawn]: '拂晓',
  [TimeSlot.morning1]: '清晨',
  [TimeSlot.morning2]: '早上',
  [TimeSlot.morning3]: '上午',
  [TimeSlot.noon]: '中午',
  [TimeSlot.afternoon]: '下午',
  [TimeSlot.evening]: '傍晚',
  [TimeSlot.night]: '晚上',
  [TimeSlot.latenight]: '深夜',
};

/** 获取时段中文名 */
export function timeSlotName(slot: TimeSlot): string {
  return TIME_SLOT_NAMES[slot];
}

/** 时段简称（用于时间线标签） */
const TIME_SLOT_SHORT_NAMES: Record<TimeSlot, string> = {
  [TimeSlot.dawn]: '拂',
  [TimeSlot.morning1]: '清',
  [TimeSlot.morning2]: '早',
  [TimeSlot.morning3]: '上',
  [TimeSlot.noon]: '午',
  [TimeSlot.afternoon]: '下',
  [TimeSlot.evening]: '傍',
  [TimeSlot.night]: '晚',
  [TimeSlot.latenight]: '深',
};

/** 获取时段简称 */
export function timeSlotShortName(slot: TimeSlot): string {
  return TIME_SLOT_SHORT_NAMES[slot];
}

/** 是否为额外时段（拂晓/深夜） */
export function isSpecialSlot(slot: TimeSlot): boolean {
  return slot === TimeSlot.dawn || slot === TimeSlot.latenight;
}

/** 时段 AI 描述 — 注入事件生成 prompt */
const TIME_SLOT_DESCRIPTIONS: Record<TimeSlot, string> = {
  [TimeSlot.dawn]: '天将破晓，万籁俱寂，东方泛起微光',
  [TimeSlot.morning1]: '晨雾渐散，空气清冽，城市刚刚苏醒',
  [TimeSlot.morning2]: '朝阳初升，光线柔和，早市的烟火气弥漫',
  [TimeSlot.morning3]: '阳光正好，游人渐多，景点逐渐热闹',
  [TimeSlot.noon]: '阳光正盛，游人最多，午间小憩的氛围',
  [TimeSlot.afternoon]: '午后暖光，节奏放缓，适合漫步的时光',
  [TimeSlot.evening]: '夕阳西下，金光洒落，天色渐暗',
  [TimeSlot.night]: '华灯初上，夜色迷人，城市另一面展现',
  [TimeSlot.latenight]: '夜深人静，灯火阑珊，只有零星行人',
};

/** 获取时段 AI 描述 */
export function timeSlotDescription(slot: TimeSlot): string {
  return TIME_SLOT_DESCRIPTIONS[slot];
}

/** 常规时段顺序（不含 dawn/latenight） */
const NORMAL_SLOTS: TimeSlot[] = [
  TimeSlot.morning1, TimeSlot.morning2, TimeSlot.morning3,
  TimeSlot.noon, TimeSlot.afternoon, TimeSlot.evening, TimeSlot.night,
];

/** 推进时间 — 事件完成后调用，返回新的时段和是否跨天 */
export function nextTimeSlot(current: TimeSlot): { slot: TimeSlot; newDay: boolean } {
  switch (current) {
    case TimeSlot.dawn:      return { slot: TimeSlot.morning1, newDay: false };
    case TimeSlot.morning1:  return { slot: TimeSlot.morning2, newDay: false };
    case TimeSlot.morning2:  return { slot: TimeSlot.morning3, newDay: false };
    case TimeSlot.morning3:  return { slot: TimeSlot.noon,     newDay: false };
    case TimeSlot.noon:      return { slot: TimeSlot.afternoon, newDay: false };
    case TimeSlot.afternoon: return { slot: TimeSlot.evening,  newDay: false };
    case TimeSlot.evening:   return { slot: TimeSlot.night,    newDay: false };
    case TimeSlot.night:     return { slot: TimeSlot.morning1, newDay: true };
    case TimeSlot.latenight: return { slot: TimeSlot.morning1, newDay: true };
  }
}

/** 触发额外时段（道具/特殊事件调用） */
export function triggerSpecialTime(slot: TimeSlot.dawn | TimeSlot.latenight): TimeSlot {
  return slot;
}

/** 根据索引获取接下来 N 个时段（用于批量事件生成） */
export function getUpcomingSlots(current: TimeSlot, count: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let slot = current;
  for (let i = 0; i < count; i++) {
    slots.push(slot);
    const next = nextTimeSlot(slot);
    slot = next.slot;
  }
  return slots;
}

/** 所有时段的有序列表（用于时间线渲染） */
export const ALL_TIME_SLOTS: TimeSlot[] = Object.values(TimeSlot).filter(
  (v): v is TimeSlot => typeof v === 'number'
);
