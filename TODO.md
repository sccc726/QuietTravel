# 别处 · Elsewhere — 驻地系统开发计划

## 状态机

```
idle(闲置页 /home)
  → "计划旅行" → 地图页(mode=plan)
    → "规划旅行" → 选天数+出行方式
      → "去买票" → 选车票(3去程+3返程选项) → 预扣往返路费+创建trip
        → traveling_out(旅行页 /travel, 去程)
          → 到达 → touring(地图页, 景点选择, 无搜索框)
            → 进入游览(游览页, 现有流程)
            → "回家" → traveling_home(旅行页, 返程)
              → 到达 → idle(闲置页)
```

一次旅行 = 一个目的地。多目的地旅行为后续扩展。
错过返程火车 → 返程票作废 → 重新买票（从当前时间起一天内3个选项）。

---

## 第 3 步：数据库补全 + API 改动

### 3.1 trips 表补充票务字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `outbound_depart_day` | INT | 去程出发日 |
| `outbound_depart_slot` | INT | 去程出发时段 |
| `outbound_arrive_day` | INT | 去程到达日 |
| `outbound_arrive_slot` | INT | 去程到达时段 |
| `return_depart_day` | INT | 返程出发日 |
| `return_depart_slot` | INT | 返程出发时段 |
| `return_arrive_day` | INT | 返程到达日 |
| `return_arrive_slot` | INT | 返程到达时段 |
| `return_ticket_valid` | BOOLEAN DEFAULT true | 返程票是否有效 |

`travel_cost` 为单程票价，出发时预扣 `travel_cost * 2`。

### 3.2 现有用户处理

server.ts 启动时：`UPDATE players SET home_name='北京', home_lat=39.9042, home_lng=116.4074 WHERE home_name IS NULL;`

### 3.3 API 改动

| 文件 | 改动 |
|------|------|
| `api/auth/route.ts` | 注册接收 homeName/homeLat/homeLng；返回增加 homeName/homeLat/homeLng/status/currentTripId |
| `api/progress/route.ts` | GET 返回 homeName/homeLat/homeLng/status/currentTripId；PATCH 支持更新 status/currentTripId |
| `api/journals/route.ts` | POST 自动从 players.current_trip_id 取值写入 trip_id；GET 返回 trip_id + 支持 `?tripId=` 筛选 |
| `api/trips/route.ts` | 新建：POST 创建旅行（含票务字段）+ GET 列表（支持 `?status=` 筛选）|
| `api/trips/[id]/route.ts` | 新建：PATCH 更新旅行状态（含返程票作废）+ GET 详情（含关联 journals）|

---

## 第 4 步：旅行票务逻辑

扩展 `lib/travel.ts`：

- **`generateOutboundTickets(currentDay, currentSlot, distanceKm, mode)`** — 根据当前游戏时间生成3个去程票选项，间隔约1时段，>800km支持过夜车
- **`generateReturnTickets(arriveDay, arriveSlot, tripDays, distanceKm, mode)`** — 生成3个返程票选项
- **`generateRebuyReturnTickets(currentDay, currentSlot, distanceKm, mode)`** — 错过火车后从当前时间一天内生成3个选项
- **`touringTimeSlots(arriveDay, arriveSlot, returnDepartDay, returnDepartSlot)`** — 计算可游览时段数，<3时警告

票务选项格式：`{ departDay, departSlot, arriveDay, arriveSlot, label }`
label 示例："第一天清晨 → 第一天上午"

---

## 第 5 步：注册页改造（选择"家"）

1. 第一步：名称 + 暗号
2. 第二步："你的家在哪里？"，复用目的地搜索+校准（限定中国城市）
3. 选择后传 homeName/homeLat/homeLng 给 `/api/auth`
4. 已登录用户跳过注册页

涉及文件：`app/page.tsx`、`lib/auth.ts`

---

## 第 6 步：闲置页 `/home`

新建 `app/home/page.tsx`：

- 顶部时间线（与其他页一致）
- 家的场景：城市名 + MiniMap 标记
- 资源：金钱、心境
- "计划旅行"按钮 → 跳转 `/map?mode=plan`
- 旅行记录列表（`/api/trips?status=completed`）

---

## 第 7 步：地图页改造（旅行规划模式）

### 7.1 入口
- 从闲置页进入（`mode=plan`）：显示"计划旅行"模式

### 7.2 "规划旅行"按钮
- 替代原"出发去这里"
- 弹出 Modal：旅行天数选择 + 出行方式（目前仅高铁亮色）

### 7.3 "去买票" Modal
- 3个去程票选项 + 3个返程票选项
- 总费用（往返）+ 游览时间预览
- 游览时段 < 3 时警告
- 确认 → 预扣往返路费 + 创建 trips + 跳转旅行页

### 7.4 "回家"按钮
- 地图页 header 右侧
- 有返程票且有效 → 进入旅行页（返程）
- 返程票过期 → 弹出重新买票选项
- 金钱不足 → 提示"路费不足"

涉及文件：`app/map/page.tsx`

---

## 第 8 步：旅行页 `/travel`

新建 `app/travel/page.tsx`：

- 去程/返程共用，通过参数区分
- 显示：出发地→目的地、出发→到达时间、当前时段
- 时间推进：每 5-10 秒推进 1 个时段
- 到达后：去程→跳转地图页（选景点）；返程→跳转闲置页
- 预留：旅途中随机事件区域

---

## 第 9 步：游览页/确认页改造 + 路由守卫

### 9.1 游览页
- 保存 journal 时自动写入 trip_id
- 每次推进时间检查是否错过返程火车 → 标记 return_ticket_valid=false + 提示

### 9.2 确认页
- 有活跃旅行时显示返程信息

### 9.3 路由守卫
- `status=idle` + 访问 `/map` 无 `mode=plan` → 跳转 `/home`
- `status=touring` + 访问 `/home` → 跳转 `/map`
- 已登录用户访问 `/` → 按 status 跳转

涉及文件：`app/visit/touring/page.tsx`、`app/visit/confirm/[...]/page.tsx`、各页面路由守卫

---

## 依赖关系

```
3(数据库+API) → 4(票务逻辑) → 5(注册页) / 6(闲置页) / 7(地图页) → 8(旅行页) → 9(改造+守卫)
```

## 后续扩展预留

- trips 表 destination_slug 为单值，后续支持多目的地时可改为 trips_destinations 关联表
- 旅行页预留随机事件区域
- TRANSPORT_CONFIG 预留飞机/自驾参数
- dawn/latenight 预留时段可用于过夜车特殊事件
