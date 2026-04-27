# 别处 · Elsewhere (Demo) — 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **地图**: Leaflet + react-leaflet + 高德瓦片图层（无需 API Key）
- **AI**: coze-coding-dev-sdk（doubao-seed-2-0-mini/lite + web-search + image-generation）
- **数据库**: Supabase PostgreSQL（service_role_key 无 RLS 限制）
- **认证**: 简单 token 认证（base64 + SHA-256 签名，30 天有效）

## 目录结构

```
├── public/                                # 静态资源（含 touring-bgm.mp3）
├── scripts/                               # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── page.tsx                       # 角色创建页（旅人名称+暗号）
│   │   ├── map/
│   │   │   ├── page.tsx                   # 目的地选择页（搜索+地图+双栏景点/打卡地）
│   │   │   └── components/map-inner.tsx   # Leaflet 地图组件（三色标记：橙/浅绿/灰）
│   │   ├── visit/
│   │   │   ├── confirm/[destinationId]/[placeId]/page.tsx  # 游览确认页
│   │   │   └── touring/page.tsx           # 游览中页面（定时事件+状态持久化+背景音乐）
│   │   ├── api/
│   │   │   ├── auth/route.ts              # 认证（注册/登录同一接口）
│   │   │   ├── progress/route.ts          # 玩家进度（GET/POST/PATCH，含 touring_state）
│   │   │   ├── journals/route.ts          # 游记归档（GET/POST，visit_journals 表）
│   │   │   ├── destinations/route.ts      # 目的地同步（GET/POST，player_destinations 表）
│   │   │   ├── greeting/route.ts          # AI 问候语
│   │   │   ├── destination/
│   │   │   │   ├── validate/route.ts      # AI 校准目的地尺度（web-search+LLM）
│   │   │   │   ├── info/route.ts          # web-search 获取目的地关键词
│   │   │   │   ├── description/route.ts   # AI 生成目的地描述（~20字）
│   │   │   │   ├── attractions/route.ts   # AI 搜索景点列表
│   │   │   │   └── checkins/route.ts      # AI 搜索打卡地列表
│   │   │   └── visit/
│   │   │       ├── event/route.ts         # AI 生成游览随机事件（50-100字，30%配图）
│   │   │       └── events-batch/route.ts  # 批量生成多条事件（恢复用，1次LLM调用）
│   ├── components/
│   │   ├── ui/                             # Shadcn UI 组件库
│   │   └── time-timeline.tsx               # 时间线组件（9节点，棕色光点标记当前时段）
│   ├── lib/
│   │   ├── destinations.ts                # 核心数据结构（Destination/PlaceItem/PlaceType/TimeSlot）
│   │   ├── destination-cache.ts           # Supabase 缓存（info/attractions/checkins）
│   │   ├── auth.ts                        # 前端认证工具（localStorage token 管理）
│   │   └── utils.ts                       # 通用工具（含 safeParseLLMJsonArray）
│   ├── storage/database/
│   │   ├── supabase-client.ts             # Supabase 客户端（service_role_key）
│   │   └── shared/
│   │       ├── schema.ts                  # Drizzle schema（7张表）
│   │       └── relations.ts              # players ↔ player_progress/visit_journals/player_destinations 关系
│   └── server.ts                          # 自定义服务端入口（含数据库表自动创建）
├── globals.css                            # 全局样式（字体/Leaflet/动画）
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心数据流

1. **角色创建** → 输入旅人名称+暗号 → 注册/登录 → AI 问候语（打字机效果）→ 进入地图页
2. **搜索目的地** → AI 校准尺度（valid/too_narrow/too_broad/not_found）→ 创建运行时目的地 → 保存到服务端 → 地图飞到坐标
3. **目的地选择** → 地图光点点击或搜索 → 并行获取 description/attractions/checkins → 全量列表+排序展示
4. **点选地点** → 有游览状态（已完成/进行中）直接跳游览页；全新地点走确认页（含未完成游览警告）→ 确认出发
5. **游览中** → 定时 AI 随机事件（20-60min间隔，30%配图，每景点最多1图）→ 随意逛逛按钮 → 背景音乐
6. **游览状态持久化** → 每30秒保存 touring_state 到服务端（含事件列表）→ 页面刷新/关闭后可恢复 → 批量补生成错过事件
7. **游览完成** → 保存 completed:true + events 列表 → 再次进入显示"已来过"视图 + 历史游记 + "重新游览"按钮
8. **游览返回** → 恢复地图状态（sessionStorage）→ 已游览地点替换为新地点 → 进度同步服务端

## 目的地管理

- `destinations.ts` 预设列表为空，所有目的地由搜索动态创建
- 目的地列表存储于服务端 `player_destinations` 表，初始化时从服务端加载
- sessionStorage 作为本地缓存，与服务端合并（服务端为准，补充本地独有）
- `destinationSlug(name)` 生成 URL 安全的 ID
- API 路由通过请求体接收 `destinationName`，不依赖静态列表
- 搜索校准通过后，`confirmDestination` 同时写入 state + 服务端

## 校准逻辑（/api/destination/validate）

- 合适尺度 = 该范围内有约 7-10 个值得去的景点和打卡地
- too_narrow（夫子庙→南京）：建议扩大到上级区域
- too_broad（江苏省→苏州/南京/扬州）：建议缩小到具体城市
- not_found（巴黎/霍格沃茨）：境外或虚构地点
- 所有目的地限定中国境内（坐标 18°-54°N, 73°-135°E）

## 数据库表结构

- `players(id, username, password, game_day, game_time_slot, money, mood, created_at)` — username UNIQUE
- `player_progress(id, player_id, destination_slug, visited_place_ids, total_places, updated_at, touring_state)` — UNIQUE(player_id, destination_slug)
- `visit_journals(id, player_id, destination_slug, place_id, place_name, events JSONB, has_image, completed_at, created_at)` — 每次游览完成写入一条，同一地点可有多条
- `cache_info(destination_slug PK, destination_name, info JSONB, created_at)`
- `cache_attractions(destination_slug PK, attractions JSONB, created_at)`
- `cache_checkins(destination_slug PK, checkins JSONB, created_at)`
- `player_destinations(id, player_id, destination_slug, destination_name, lat, lng, created_at)` — 玩家目的地列表，UNIQUE(player_id, destination_slug)

## 缓存机制

- info/attractions/checkins 缓存于 Supabase JSONB 列（通过 destination-cache.ts 读写）
- 描述和事件每次重新生成，不缓存
- `safeParseLLMJsonArray()` 容错解析（中文引号、尾部逗号、JS注释、单引号、截断JSON）

## 认证系统

- `POST /api/auth`：同一接口处理注册/登录（username 查找 → 有则验证密码，无则注册）
- 密码 SHA-256 哈希 + 盐值（`elsewhere-salt:`）
- Token: base64(`${playerId}:${timestamp}:${signature}`)，30天有效期
- 前端 `lib/auth.ts` 管理 localStorage 中的 token

## 时间系统

- 9 个时段：dawn(拂晓)、morning1(清晨)、morning2(早上)、morning3(上午)、noon(中午)、afternoon(下午)、evening(傍晚)、night(晚上)、latenight(深夜)
- 7 个常规时段组成一个日循环：清晨→晚上，之后跨天回到清晨
- dawn 和 latenight 为预留时段，正常推进时跳过，仅通过 `triggerSpecialTime()` 激活（道具/特殊事件）
- 玩家游戏时间存储在 `players` 表的 `game_day`(INT) 和 `game_time_slot`(INT) 列
- 新玩家默认：第 1 天 · 清晨
- 游览时每个随机事件推进一个时段
- 景点不跨天（最多 3 个事件，7 时段足够）
- 时间影响 AI 事件生成（prompt 注入时段描述）和页面色调
- `TimeTimeline` 组件在地图页/确认页/游览页顶部常显（9 节点 + 当前时段棕色光点 + 心境♥左侧 + 金钱◆右侧）

## 资源系统

- 金钱（money）：默认 500，最小 0，无上限，整数
- 心境（mood）：默认 10，范围 0-10，整数
- 存储在 `players` 表的 `money`(INT, default 500) 和 `mood`(INT, default 10) 列
- `/api/auth` 返回 money + mood，`/api/progress` GET 返回 + PATCH 支持更新
- `lib/auth.ts` 缓存：`getCachedResources()` / `cacheResources()` / `cachePlayerState()` 统一缓存时间+资源
- `TimeTimeline` 接收 `money` 和 `mood` props，在时间线左右两侧常显

## 地图标记状态

- 橙色（默认）：未游览
- 浅绿色：已游览至少1个地点
- 灰色：所有地点已游览（无脉冲动画）
- `MarkerState`：`unvisited` | `visited` | `completed`

## 游览状态持久化

- `touring_state` JSONB 列存储：`{ destinationId, destinationName, placeId, totalEvents, completedEvents, timerStartAt, intervalMs, hasImage, lastSavedAt }`
- 每 30 秒自动保存（PATCH /api/progress）
- 页面关闭前通过 `fetch + keepalive` 保存
- 恢复逻辑：计算时间差 → 估算错过事件数（平均40min间隔）→ events-batch 批量生成 → 快速展示 → 继续正常倒计时
- 超过 4 小时未恢复视为游览结束
- 游览结束后清除 touring_state

## 图片生成规范

- 概率 30%，每个景点最多 1 张图片（`hasImage` 参数控制）
- 英文摄影术语 prompt（muted pastel color grading, soft focus, no vintage effect）
- 人物从背后/剪影处理，不显示正面
- 倒计时文案：有图片时显示"摄影中..."，无图片时显示"漫步中..."

## 设计风格

- 浅色文艺留白：暖白底色、低饱和青绿点缀、橙色光点标记
- 字体：霞鹜文楷(LXGW WenKai)正文 + 思源宋体(Noto Serif SC)标题
- 通过 Google Fonts CN 域名加载（fonts.googleapis.cn）
- Leaflet CSS 通过 globals.css 的 @import 引入

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 开发规范

### 编码规范

- TypeScript `strict` 心智；禁止隐式 `any` 和 `as any`
- 函数参数、返回值、事件对象需明确类型
- 清理未使用的变量和导入

### Hydration 问题防范

1. 严禁 JSX 中直接使用 Math.random/Date.now/typeof window → 使用 useState + useEffect
2. 禁止使用 head 标签，优先 metadata
3. 三方 CSS/字体通过 globals.css @import 或 next/font
4. **localStorage 缓存值初始化**：gameDay/gameTimeSlot/money/mood 等 localStorage 缓存值，useState 用默认值初始化（SSR 安全），在 useEffect 中从缓存更新（避免 hydration mismatch）

### Leaflet 注意事项

- 必须动态 import 禁用 SSR（`dynamic(() => import(...), { ssr: false })`）
- divIcon 需覆盖默认样式：`.leaflet-div-icon { background: transparent!important; border: none!important; }`
- 默认图标路径需手动修复：`delete (L.Icon.Default.prototype as any)._getIconUrl`
- 地图初始化后必须调用 `map.invalidateSize()`
- 标记动态管理：通过 useEffect 对比 destinations 数组增删 marker

### PlaceItem ID 规范

- 景点: `${destinationId}-attr-${idx}`
- 打卡地: `${destinationId}-checkin-${idx}`
- 通过 `placeId.includes('-checkin-')` 区分类型

### sessionStorage 持久化

- `cyber-voyage-destinations` — 运行时目的地列表
- `cyber-voyage-map-state` — 地图页面状态（选中目的地、展示列表等）
- `elsewhere-auth` — 认证信息（token/playerId/username + gameDay/gameTimeSlot/money/mood 缓存）
- 离开地图页前保存，返回时恢复后清除

## 常用命令

- `pnpm ts-check` — TypeScript 类型检查
- `pnpm lint --quiet` — ESLint 检查
- `pnpm build` — 构建
