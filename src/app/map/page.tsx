'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { destinations, type Destination, type PlaceItem } from '@/lib/destinations';
import { ArrowLeft, MapPin, Camera, Landmark } from 'lucide-react';
import { useRouter } from 'next/navigation';

/** 动态加载地图组件，禁用 SSR */
const MapInner = dynamic(() => import('./components/map-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-background">
      <p
        className="text-sm text-muted-foreground/40 tracking-wider animate-fade-in-up"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        地图加载中...
      </p>
    </div>
  ),
});

/** 从数组中随机取 n 条，排除指定 id */
function pickRandom<T extends { id: string }>(
  arr: T[],
  n: number,
  excludeIds: Set<string> = new Set()
): T[] {
  const pool = arr.filter(item => !excludeIds.has(item.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** sessionStorage 键 */
const STORAGE_KEY = 'cyber-voyage-map-state';

/** 需要持久化的地图页面状态 */
interface MapPageState {
  selectedId: string | null;
  aiDescription: string;
  allAttractions: PlaceItem[];
  allCheckins: PlaceItem[];
  displayAttractionIds: string[];
  displayCheckinIds: string[];
}

function saveMapState(state: MapPageState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function loadMapState(): MapPageState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MapPageState;
  } catch {
    return null;
  }
}

function clearMapState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitedPlaceId = searchParams.get('visited') ?? '';

  const [selected, setSelected] = useState<Destination | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(false);

  // 全量数据（从 API 获取）
  const [allAttractions, setAllAttractions] = useState<PlaceItem[]>([]);
  const [allCheckins, setAllCheckins] = useState<PlaceItem[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  // 记录当前数据对应的目的地 ID，用于判断是否需要重新请求
  const [loadedForId, setLoadedForId] = useState<string | null>(null);

  // 当前展示的3条（改为 useState 以支持持久化和精确替换）
  const [displayAttractions, setDisplayAttractions] = useState<PlaceItem[]>([]);
  const [displayCheckins, setDisplayCheckins] = useState<PlaceItem[]>([]);

  /** 根据 id 列表从全量数据中提取条目 */
  const getByIds = useCallback(
    (ids: string[], pool: PlaceItem[]): PlaceItem[] => {
      const map = new Map(pool.map(p => [p.id, p]));
      return ids.map(id => map.get(id)).filter((p): p is PlaceItem => !!p);
    },
    []
  );

  // 初始化：尝试从 sessionStorage 恢复状态
  useEffect(() => {
    const saved = loadMapState();
    if (!saved) return;

    // 恢复选中目的地
    if (saved.selectedId) {
      const dest = destinations.find(d => d.id === saved.selectedId);
      if (dest) setSelected(dest);
    }

    setAiDescription(saved.aiDescription);
    setAllAttractions(saved.allAttractions);
    setAllCheckins(saved.allCheckins);
    setLoadedForId(saved.selectedId);

    // 从全量数据中恢复展示列表
    const restoredAttrs = getByIds(saved.displayAttractionIds, saved.allAttractions);
    const restoredCheckins = getByIds(saved.displayCheckinIds, saved.allCheckins);

    // 如果有 visitedPlaceId，替换对应的展示条目
    if (visitedPlaceId) {
      const isCheckin = visitedPlaceId.includes('-checkin-');
      const currentDisplay = isCheckin ? restoredCheckins : restoredAttrs;

      const visitedIdx = currentDisplay.findIndex(p => p.id === visitedPlaceId);
      if (visitedIdx !== -1) {
        const currentIds = new Set(currentDisplay.map(p => p.id));
        const pool = isCheckin ? saved.allCheckins : saved.allAttractions;
        const candidates = pool.filter(p => !currentIds.has(p.id));

        if (candidates.length > 0) {
          const replacement = candidates[Math.floor(Math.random() * candidates.length)];
          const newDisplay = [...currentDisplay];
          newDisplay[visitedIdx] = replacement;

          if (isCheckin) {
            setDisplayCheckins(newDisplay);
            setDisplayAttractions(restoredAttrs);
          } else {
            setDisplayAttractions(newDisplay);
            setDisplayCheckins(restoredCheckins);
          }
        } else {
          // 没有候选项可替换，保持原样
          setDisplayAttractions(restoredAttrs);
          setDisplayCheckins(restoredCheckins);
        }
      } else {
        setDisplayAttractions(restoredAttrs);
        setDisplayCheckins(restoredCheckins);
      }
    } else {
      setDisplayAttractions(restoredAttrs);
      setDisplayCheckins(restoredCheckins);
    }

    // 恢复后清除，避免下次进入误恢复
    clearMapState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedPlaceId]);

  // 选中目的地时：获取 AI 描述 + 景点 + 打卡地
  useEffect(() => {
    if (!selected) return;
    // 如果已有该目的地的数据（从 sessionStorage 恢复或之前加载的），跳过
    if (loadedForId === selected.id) return;

    let cancelled = false;

    async function loadDestination(dest: Destination) {
      setDescriptionLoading(true);
      setPlacesLoading(true);

      const [descRes, attrRes, checkinRes] = await Promise.allSettled([
        fetch('/api/destination/description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationId: dest.id }),
        }),
        fetch('/api/destination/attractions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationId: dest.id }),
        }),
        fetch('/api/destination/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationId: dest.id }),
        }),
      ]);

      if (cancelled) return;

      let newAttractions: PlaceItem[] = [];
      let newCheckins: PlaceItem[] = [];

      // 处理描述
      if (descRes.status === 'fulfilled') {
        try {
          const data = await descRes.value.json();
          if (data.description) setAiDescription(data.description);
        } catch { /* ignore */ }
      }
      setDescriptionLoading(false);

      // 处理景点
      if (attrRes.status === 'fulfilled') {
        try {
          const data = await attrRes.value.json();
          if (data.data?.attractions) newAttractions = data.data.attractions;
        } catch { /* ignore */ }
      }

      // 处理打卡地
      if (checkinRes.status === 'fulfilled') {
        try {
          const data = await checkinRes.value.json();
          if (data.data?.checkins) newCheckins = data.data.checkins;
        } catch { /* ignore */ }
      }

      setAllAttractions(newAttractions);
      setAllCheckins(newCheckins);
      setLoadedForId(dest.id);
      setDisplayAttractions(pickRandom(newAttractions, 3));
      setDisplayCheckins(pickRandom(newCheckins, 3));
      setPlacesLoading(false);
    }

    loadDestination(selected);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const handleDestinationClick = useCallback((dest: Destination) => {
    setSelected(prev => (prev?.id === dest.id ? null : dest));
  }, []);

  /** 刷新：重新随机挑选 */
  const handleRefresh = useCallback(() => {
    const attrIds = new Set(displayAttractions.map(p => p.id));
    const checkinIds = new Set(displayCheckins.map(p => p.id));
    setDisplayAttractions(pickRandom(allAttractions, 3));
    setDisplayCheckins(pickRandom(allCheckins, 3));
    // 上面故意没用 excludeIds，换一批就是完全重新随机
    void attrIds;
    void checkinIds;
  }, [allAttractions, allCheckins, displayAttractions, displayCheckins]);

  /** 离开页面前保存状态 */
  const saveStateBeforeLeave = useCallback(() => {
    if (!selected) return;
    saveMapState({
      selectedId: selected.id,
      aiDescription,
      allAttractions,
      allCheckins,
      displayAttractionIds: displayAttractions.map(p => p.id),
      displayCheckinIds: displayCheckins.map(p => p.id),
    });
  }, [selected, aiDescription, allAttractions, allCheckins, displayAttractions, displayCheckins]);

  /** 点击地点卡片 — 先保存状态再跳转 */
  const handlePlaceClick = useCallback(
    (placeId: string, destinationId: string) => {
      saveStateBeforeLeave();
      router.push(`/visit/confirm/${destinationId}/${placeId}`);
    },
    [saveStateBeforeLeave, router]
  );

  /** 返回首页 */
  const handleBack = useCallback(() => {
    clearMapState();
    router.push('/');
  }, [router]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm z-20 shrink-0 animate-fade-in-up">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground/60 hover:text-foreground/70 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span style={{ fontFamily: 'var(--font-serif)' }}>返回</span>
        </button>
        <h1
          className="text-base font-light tracking-[0.1em] text-foreground/80"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          选择目的地
        </h1>
        <div className="w-12" />
      </header>

      {/* 地图区域 */}
      <div className="flex-1 relative">
        <MapInner
          destinations={destinations}
          selectedId={selected?.id ?? null}
          onDestinationClick={handleDestinationClick}
        />

        {/* 底部面板 */}
        {selected && (
          <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/40 z-10 animate-fade-in-up">
            <div className="max-w-2xl mx-auto px-6 py-4">
              {/* 目的地标题 + AI 描述 */}
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-orange-400/80" />
                <h2
                  className="text-lg font-light tracking-wider text-foreground/85"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {selected.name}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground/60 mb-4 leading-relaxed pl-6 min-h-[1.2em]">
                {descriptionLoading ? (
                  <span className="inline-block w-12 h-px bg-muted-foreground/20 animate-pulse" />
                ) : (
                  aiDescription || selected.description
                )}
              </p>

              {/* 双栏布局 */}
              <div className="grid grid-cols-2 gap-4 pl-6">
                {/* 左栏：景点 */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Landmark className="w-3 h-3 text-accent-green/60" />
                    <span
                      className="text-[11px] text-muted-foreground/45 tracking-widest"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      景点
                    </span>
                  </div>
                  {placesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="h-14 rounded-lg bg-muted/30 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : displayAttractions.length > 0 ? (
                    <div className="space-y-2">
                      {displayAttractions.map(item => (
                        <PlaceCard
                          key={item.id}
                          item={item}
                          destinationId={selected.id}
                          onClick={handlePlaceClick}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/30 py-4 text-center">暂无数据</p>
                  )}
                </div>

                {/* 右栏：打卡地 */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Camera className="w-3 h-3 text-orange-400/60" />
                    <span
                      className="text-[11px] text-muted-foreground/45 tracking-widest"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      打卡地
                    </span>
                  </div>
                  {placesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="h-14 rounded-lg bg-muted/30 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : displayCheckins.length > 0 ? (
                    <div className="space-y-2">
                      {displayCheckins.map(item => (
                        <PlaceCard
                          key={item.id}
                          item={item}
                          destinationId={selected.id}
                          onClick={handlePlaceClick}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/30 py-4 text-center">暂无数据</p>
                  )}
                </div>
              </div>

              {/* 底部操作 */}
              <div className="flex items-center justify-center gap-4 mt-4">
                {allAttractions.length > 3 || allCheckins.length > 3 ? (
                  <button
                    onClick={handleRefresh}
                    className="text-[11px] text-muted-foreground/35 hover:text-accent-green/70 transition-colors duration-300 tracking-wider"
                  >
                    换一批
                  </button>
                ) : null}
                <button
                  onClick={() => setSelected(null)}
                  className="text-[11px] text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors duration-300 tracking-wider"
                >
                  收起
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 地点卡片组件 */
function PlaceCard({
  item,
  destinationId,
  onClick,
}: {
  item: PlaceItem;
  destinationId: string;
  onClick: (placeId: string, destinationId: string) => void;
}) {
  const handleClick = () => {
    onClick(item.id, destinationId);
  };

  return (
    <div
      onClick={handleClick}
      className="px-3 py-2.5 rounded-lg border border-border/40 bg-card/50 hover:bg-accent/30 hover:border-accent-green/15 transition-all duration-300 group cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="text-[13px] text-foreground/80 group-hover:text-accent-green transition-colors duration-300"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {item.name}
        </span>
        {item.tag && (
          <span className="text-[9px] text-muted-foreground/35 border border-border/50 rounded px-1 py-px">
            {item.tag}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground/45 leading-relaxed">
        {item.description}
      </p>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-background flex items-center justify-center">
          <p className="text-sm text-muted-foreground/30">加载中...</p>
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}
