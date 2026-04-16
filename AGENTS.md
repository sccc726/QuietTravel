# 赛博旅途 (Cyber Voyage) — 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **地图**: Leaflet + react-leaflet + 高德瓦片图层（无需 API Key）
- **AI**: coze-coding-dev-sdk（doubao-seed-2-0-mini/lite + web-search）

## 目录结构

```
├── .cache/                                # 服务端缓存（destination-*.json）
├── public/                                # 静态资源
├── scripts/                               # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── page.tsx                       # 角色创建页（仅角色名）
│   │   ├── map/
│   │   │   ├── page.tsx                   # 目的地选择页（双栏景点/打卡地）
│   │   │   └── components/map-inner.tsx   # Leaflet 地图组件（SSR disabled）
│   │   ├── visit/
│   │   │   ├── confirm/[destinationId]/[placeId]/page.tsx  # 游览确认页
│   │   │   └── touring/page.tsx           # 游览中页面（定时事件+随意逛逛）
│   │   ├── api/
│   │   │   ├── greeting/route.ts          # AI 问候语
│   │   │   ├── destination/
│   │   │   │   ├── info/route.ts          # web-search 获取目的地关键词
│   │   │   │   ├── description/route.ts   # AI 生成目的地描述（~20字）
│   │   │   │   ├── attractions/route.ts   # AI 搜索景点列表
│   │   │   │   └── checkins/route.ts      # AI 搜索打卡地列表
│   │   │   └── visit/event/route.ts       # AI 生成游览随机事件（50-100字）
│   ├── components/ui/                     # Shadcn UI 组件库
│   ├── lib/
│   │   ├── destinations.ts                # 核心数据结构（Destination/PlaceItem/PlaceType）
│   │   ├── destination-cache.ts           # 服务端 JSON 文件缓存
│   │   └── utils.ts                       # 通用工具函数
│   └── server.ts                          # 自定义服务端入口
├── globals.css                            # 全局样式（字体/Leaflet/动画）
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 核心数据流

1. **角色创建** → AI 生成问候语（打字机效果）→ 选择目的地
2. **目的地选择** → 地图点击 → 并行获取 description/attractions/checkins → 双栏展示随机3条
3. **点选地点** → 确认页（随机事件数：景点2~3/打卡地1~2）→ 确认出发
4. **游览中** → 定时 AI 随机事件（20-60min 间隔）→ 随意逛逛按钮（80%后浮现）→ 跳转时间测试按钮

## 缓存机制

- `.cache/destination-info.json` — 目的地关键词（web-search 一次性）
- `.cache/destination-attractions.json` — 景点列表（web-search + LLM 提取）
- `.cache/destination-checkins.json` — 打卡地列表（web-search + LLM 提取）
- 描述和事件每次重新生成，不缓存

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

### Leaflet 注意事项

- 必须动态 import 禁用 SSR（`dynamic(() => import(...), { ssr: false })`）
- divIcon 需覆盖默认样式：`.leaflet-div-icon { background: transparent!important; border: none!important; }`
- 默认图标路径需手动修复：`delete (L.Icon.Default.prototype as any)._getIconUrl`
- 地图初始化后必须调用 `map.invalidateSize()`

### PlaceItem ID 规范

- 景点: `${destinationId}-attr-${idx}`
- 打卡地: `${destinationId}-checkin-${idx}`
- 通过 `placeId.includes('-checkin-')` 区分类型

## 常用命令

- `pnpm ts-check` — TypeScript 类型检查
- `pnpm lint --quiet` — ESLint 检查
- `pnpm build` — 构建
