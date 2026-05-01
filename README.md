# 别处 · Elsewhere

一款文艺风旅行探索 Web 应用。玩家创建旅人身份，在中国境内的虚拟时空中搜索目的地、游览景点、遇见随机事件，记录属于自己的旅行故事。

## 特性

- **AI 驱动**：目的地搜索、景点推荐、随机事件、图片生成均由 AI 实时生成
- **时间系统**：9 时段游戏日循环，事件推进时间，影响事件内容和页面色调
- **资源系统**：金钱（◆）和心境（♥），在时间线两侧常显
- **地图探索**：Leaflet 地图 + 高德瓦片，三色标记区分游览状态
- **游览体验**：定时随机事件、30% 配图、背景音乐、状态持久化与恢复
- **旅行成本**：基于 Haversine 距离的高铁费用和耗时计算（进行中）
- **文艺风格**：霞鹜文楷 + 思源宋体，暖白留白设计

## 技术栈

| 维度 | 选择 |
|------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + shadcn/ui + Tailwind CSS 4 |
| Language | TypeScript 5 |
| 地图 | Leaflet + react-leaflet + 高德瓦片 |
| AI | coze-coding-dev-sdk (doubao-seed-2-0-mini/lite) |
| 数据库 | Supabase PostgreSQL |
| 认证 | Token (base64 + SHA-256, 30天有效) |

## 快速开始

```bash
pnpm install
pnpm dev          # 开发模式，端口 5000
pnpm build        # 构建
pnpm start        # 生产模式
```

## 项目结构

```
src/
├── app/                    # 页面 + API 路由
│   ├── page.tsx            # 角色创建
│   ├── map/                # 目的地选择 + 地图
│   ├── visit/              # 游览确认 + 游览中
│   └── api/                # 后端接口
├── components/
│   ├── ui/                 # shadcn/ui 组件库
│   └── time-timeline.tsx   # 时间线组件
├── lib/                    # 工具库
│   ├── destinations.ts     # 核心数据结构 + 时间系统
│   ├── travel.ts           # 旅行计算逻辑
│   ├── auth.ts             # 认证 + 缓存管理
│   └── destination-cache.ts # Supabase 缓存
└── storage/database/       # Drizzle ORM schema + Supabase 客户端
```

## 开发规范

- 包管理：仅使用 pnpm
- 类型检查：`pnpm ts-check`
- Lint：`pnpm lint --quiet`
- 严禁隐式 any、SSR 中使用 localStorage、head 标签引入资源
