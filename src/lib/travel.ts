/**
 * 旅行计算逻辑 — 距离、耗时、费用
 */

/** 出行方式（预留 flight / drive） */
export type TransportMode = 'train';

/** 出行方式配置 */
export const TRANSPORT_CONFIG: Record<TransportMode, {
  speed: number;      // km/h
  costPerKm: number;  // 元/km
  label: string;      // 中文显示名
}> = {
  train: { speed: 300, costPerKm: 0.5, label: '高铁' },
};

/** 地球半径 (km) */
const EARTH_RADIUS_KM = 6371;

/**
 * Haversine 公式计算两点间球面距离
 * @returns 距离 (km)
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * 旅行耗时（游戏时段数）
 *
 * 高铁 300km/h，分段映射：
 *   ≤1h（≤300km）  → 1 时段
 *   ≤2h（≤600km）  → 2 时段
 *   ≤4h（≤1200km） → 3 时段
 *   >4h（>1200km） → 4 时段
 */
export function travelTimeSlots(
  distanceKm: number,
  mode: TransportMode = 'train',
): number {
  const config = TRANSPORT_CONFIG[mode];
  const hours = distanceKm / config.speed;
  if (hours <= 1) return 1;
  if (hours <= 2) return 2;
  if (hours <= 4) return 3;
  return 4;
}

/**
 * 单程路费（元）
 *
 * 距离 × 单价，Math.round 取整
 */
export function travelCost(
  distanceKm: number,
  mode: TransportMode = 'train',
): number {
  const config = TRANSPORT_CONFIG[mode];
  return Math.round(distanceKm * config.costPerKm);
}

/** 往返路费 */
export function roundTripCost(
  distanceKm: number,
  mode: TransportMode = 'train',
): number {
  return travelCost(distanceKm, mode) * 2;
}

/** 往返耗时（时段数） */
export function roundTripTimeSlots(
  distanceKm: number,
  mode: TransportMode = 'train',
): number {
  return travelTimeSlots(distanceKm, mode) * 2;
}
