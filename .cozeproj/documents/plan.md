# 驻地系统 — 第 2 步：旅行计算逻辑

## 概述

新建 `lib/travel.ts`，提供距离计算、旅行耗时、旅行费用三个核心函数，供后续 API 和页面调用。纯逻辑模块，无 UI 改动。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 距离算法 | Haversine 公式 | 球面两点间直线距离，精度足够（误差 <0.5%），计算简单 |
| 耗时映射 | 分段线性映射 | 实际小时 → 游戏时段数，近/中/远/超远四档 |
| 费用模型 | 距离 × 单价 | 高铁 0.5 元/km，取整 |

## 功能模块

### `lib/travel.ts`

**距离计算**
```typescript
haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number
// 返回 km，地球半径 6371km
```

**耗时计算**
```typescript
travelTimeSlots(distanceKm: number, mode: TransportMode = 'train'): number
// 高铁 300km/h，映射规则：
//   ≤1h（≤300km）→ 1 时段
//   ≤2h（≤600km）→ 2 时段
//   ≤4h（≤1200km）→ 3 时段
//   >4h（>1200km）→ 4 时段
```

**费用计算**
```typescript
travelCost(distanceKm: number, mode: TransportMode = 'train'): number
// 高铁 0.5 元/km，Math.round 取整
```

**出行方式类型**
```typescript
type TransportMode = 'train' // 预留 'flight' | 'drive'

const TRANSPORT_CONFIG: Record<TransportMode, { speed: number; costPerKm: number; label: string }> = {
  train: { speed: 300, costPerKm: 0.5, label: '高铁' },
}
```

**往返总价/总耗时**
```typescript
roundTripCost(distanceKm: number, mode?: TransportMode): number  // 单程 × 2
roundTripTimeSlots(distanceKm: number, mode?: TransportMode): number  // 单程 × 2
```

## 是否有原型设计

否（纯逻辑模块，无 UI 改动）

## 实施步骤

1. 新建 `lib/travel.ts`，实现 Haversine 距离计算 + 出行方式配置表 + 耗时映射 + 费用计算 + 往返辅助函数
2. 验证：ts-check + lint + build
