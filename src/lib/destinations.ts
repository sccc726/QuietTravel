/**
 * 赛博旅途 - 目的地与景点数据结构
 *
 * 设计原则：
 * - Destination 为顶层目的地（城市/区域）
 * - Spot 为目的地下的具体景点
 * - position 为地图上的相对坐标 (百分比)，便于不同尺寸地图自适应
 * - 预留 unlocked / cost 等字段，支持后续扩展挂机/经营逻辑
 */

export interface Spot {
  id: string;
  name: string;
  description: string;
  /** 景点在目的地内的简短标签，如 "水乡" "古镇" */
  tag?: string;
  /** 是否已解锁，预留字段 */
  unlocked?: boolean;
  /** 解锁消耗，预留字段 */
  cost?: number;
}

export interface Destination {
  id: string;
  name: string;
  /** 目的地简介 */
  description: string;
  /** 地图上的位置 (百分比 0-100) */
  position: { x: number; y: number };
  /** 旗下的景点列表 */
  spots: Spot[];
  /** 是否已解锁，预留字段 */
  unlocked?: boolean;
  /** 解锁消耗，预留字段 */
  cost?: number;
}

/** 全部目的地数据 — 后续在此数组中追加即可扩展 */
export const destinations: Destination[] = [
  {
    id: 'wuzhen',
    name: '乌镇',
    description: '枕水人家，千年古镇，江南水乡的温柔时光',
    position: { x: 72, y: 54 },
    unlocked: true,
    spots: [
      {
        id: 'dongzha',
        name: '东栅',
        description: '清晨薄雾中的老街，枕河而眠的原始水乡',
        tag: '水乡',
        unlocked: true,
      },
      {
        id: 'xizha',
        name: '西栅',
        description: '灯火阑珊的夜色里，石桥倒影如画',
        tag: '夜景',
        unlocked: true,
      },
    ],
  },
  // 后续可扩展更多目的地，例如：
  // {
  //   id: 'lijiang',
  //   name: '丽江',
  //   description: '雪山之下的柔软时光',
  //   position: { x: 35, y: 62 },
  //   unlocked: false,
  //   cost: 100,
  //   spots: [
  //     { id: 'dayan', name: '大研古镇', description: '...', tag: '古镇', unlocked: true },
  //     { id: 'yulong', name: '玉龙雪山', description: '...', tag: '雪山', unlocked: false, cost: 50 },
  //   ],
  // },
];
