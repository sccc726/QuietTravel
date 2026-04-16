/**
 * 赛博旅途 - 目的地与景点数据结构
 *
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

/** 向后兼容旧 Spot 类型 */
export type Spot = PlaceItem;

export interface Destination {
  id: string;
  name: string;
  /** 静态描述，作为降级文案 */
  description: string;
  /** 真实经纬度坐标 */
  coordinates: { lat: number; lng: number };
  /** 旗下的景点列表（静态数据，仅作降级） */
  spots: Spot[];
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

/** 全部目的地数据 — 后续在此数组中追加即可扩展 */
export const destinations: Destination[] = [
  {
    id: 'wuzhen',
    name: '乌镇',
    description: '枕水人家，千年古镇，江南水乡的温柔时光',
    coordinates: { lat: 30.7489, lng: 120.4855 },
    unlocked: true,
    spots: [
      {
        id: 'dongzha',
        name: '东栅',
        description: '清晨薄雾中的老街，枕河而眠的原始水乡',
        tag: '水乡',
        type: 'attraction' as const,
        keywords: [],
        reviews: [],
        unlocked: true,
      },
      {
        id: 'xizha',
        name: '西栅',
        description: '灯火阑珊的夜色里，石桥倒影如画',
        tag: '夜景',
        type: 'attraction' as const,
        keywords: [],
        reviews: [],
        unlocked: true,
      },
    ],
  },
];
