'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { type Destination, type PlaceItem, destinationSlug } from '@/lib/destinations';
import { ArrowLeft, MapPin, Camera, Landmark, Search, Loader2, X } from 'lucide-react';

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

/** 从数组中随机取 n 条 */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** sessionStorage 键 */
const DESTS_STORAGE_KEY = 'cyber-voyage-destinations';
const MAP_STATE_KEY = 'cyber-voyage-map-state';

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
  try { sessionStorage.setItem(MAP_STATE_KEY, JSON.stringify(state)); } catch { /* */ }
}
function loadMapState(): MapPageState | null {
  try {
    const raw = sessionStorage.getItem(MAP_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearMapState() {
  try { sessionStorage.removeItem(MAP_STATE_KEY); } catch { /* */ }
}

function saveDestinations(dests: Destination[]) {
  try { sessionStorage.setItem(DESTS_STORAGE_KEY, JSON.stringify(dests)); } catch { /* */ }
}
function loadDestinations(): Destination[] {
  try {
    const raw = sessionStorage.getItem(DESTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** 验证 API 返回类型 */
interface ValidateSuggestion { name: string; lat: number; lng: number; brief: string; }
interface ValidateResult {
  valid: boolean;
  scope?: 'too_narrow' | 'too_broad' | 'not_found';
  hint?: string;
  name?: string;
  lat?: number;
  lng?: number;
  brief?: string;
  suggestion?: ValidateSuggestion;
  suggestions?: ValidateSuggestion[];
}

function MapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visitedPlaceId = searchParams.get('visited') ?? '';

  // === 目的地列表 ===
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationsLoaded, setDestinationsLoaded] = useState(false);

  // === 选中目的地 ===
  const [selected, setSelected] = useState<Destination | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(false);

  // === 全量景点/打卡地数据 ===
  const [allAttractions, setAllAttractions] = useState<PlaceItem[]>([]);
  const [allCheckins, setAllCheckins] = useState<PlaceItem[]>([]);
  const [attractionsLoading, setAttractionsLoading] = useState(false);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);

  // 用 ref 跟踪数据完整度，供 loadedForId 守卫使用（不触发重渲染）
  const aiDescriptionRef = useRef(aiDescription);
  aiDescriptionRef.current = aiDescription;
  const allAttractionsRef = useRef(allAttractions);
  allAttractionsRef.current = allAttractions;
  const [loadSuccess, setLoadSuccess] = useState(false); // 三个请求是否都有有效数据

  // === 展示列表 ===
  const [displayAttractions, setDisplayAttractions] = useState<PlaceItem[]>([]);
  const [displayCheckins, setDisplayCheckins] = useState<PlaceItem[]>([]);

  // === 搜索相关 ===
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);

  // === 初始化：从 sessionStorage 恢复 ===
  useEffect(() => {
    const savedDests = loadDestinations();
    if (savedDests.length > 0) {
      setDestinations(savedDests);
    }
    setDestinationsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 恢复地图状态
  useEffect(() => {
    if (!destinationsLoaded) return;

    const saved = loadMapState();
    if (!saved) return;

    if (saved.selectedId) {
      const dest = destinations.find(d => d.id === saved.selectedId);
      if (dest) setSelected(dest);
    }

    setAiDescription(saved.aiDescription);
    setAllAttractions(saved.allAttractions);
    setAllCheckins(saved.allCheckins);
    setLoadedForId(saved.selectedId);

    // 从全量数据恢复展示列表
    const restoreDisplay = (ids: string[], pool: PlaceItem[]): PlaceItem[] => {
      const map = new Map(pool.map(p => [p.id, p]));
      return ids.map(id => map.get(id)).filter((p): p is PlaceItem => !!p);
    };

    let restoredAttrs = restoreDisplay(saved.displayAttractionIds, saved.allAttractions);
    let restoredCheckins = restoreDisplay(saved.displayCheckinIds, saved.allCheckins);

    // 如果有 visited 参数，替换已游览地点
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
          if (isCheckin) restoredCheckins = newDisplay;
          else restoredAttrs = newDisplay;
        }
      }
    }

    setDisplayAttractions(restoredAttrs);
    setDisplayCheckins(restoredCheckins);
    clearMapState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationsLoaded, visitedPlaceId]);

  // 持久化目的地列表
  useEffect(() => {
    if (destinationsLoaded && destinations.length > 0) {
      saveDestinations(destinations);
    }
  }, [destinations, destinationsLoaded]);

  // === 选中目的地时加载 API 数据 ===
  // loadedForId 阻止重复请求；但如果上次数据为空，重新选中时重置以允许重新请求
  useEffect(() => {
    if (!selected) return;
    if (loadedForId === selected.id) {
      // 已加载过：如果描述和景点都有数据则跳过，否则重置以重新请求
      if (aiDescriptionRef.current && allAttractionsRef.current.length > 0) return;
      // 数据不完整，重置 loadedForId 以触发重新加载
      setLoadedForId(null);
      return;
    }

    let cancelled = false;
    const destId = selected.id;

    // 记录各请求是否已完成（无论成功/失败）
    let descDone = false;
    let attrDone = false;
    let checkinDone = false;

    function checkAllDone() {
      if (descDone && attrDone && checkinDone && !cancelled) {
        setLoadedForId(destId);
      }
    }

    setDescriptionLoading(true);
    setAttractionsLoading(true);
    setCheckinsLoading(true);

    // 三个请求独立发起，各到各显
    // 描述
    fetch('/api/destination/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId: selected.id, destinationName: selected.name }),
      signal: AbortSignal.timeout(30000),
    })
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.description) setAiDescription(data.description);
      })
      .catch(() => {})
      .finally(() => { descDone = true; if (!cancelled) setDescriptionLoading(false); checkAllDone(); });

    // 景点
    fetch('/api/destination/attractions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId: selected.id, destinationName: selected.name }),
      signal: AbortSignal.timeout(30000),
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const items: PlaceItem[] = data.data?.attractions ?? [];
        setAllAttractions(items);
        setDisplayAttractions(pickRandom(items, 3));
      })
      .catch(() => {})
      .finally(() => { attrDone = true; if (!cancelled) setAttractionsLoading(false); checkAllDone(); });

    // 打卡地
    fetch('/api/destination/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationId: selected.id, destinationName: selected.name }),
      signal: AbortSignal.timeout(30000),
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const items: PlaceItem[] = data.data?.checkins ?? [];
        setAllCheckins(items);
        setDisplayCheckins(pickRandom(items, 3));
      })
      .catch(() => {})
      .finally(() => { checkinDone = true; if (!cancelled) setCheckinsLoading(false); checkAllDone(); });

    return () => { cancelled = true; };
  }, [selected?.id, loadedForId]);

  // === 搜索目的地 ===
  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query || searchLoading) return;

    setSearchLoading(true);
    setValidateResult(null);

    try {
      const res = await fetch('/api/destination/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const result: ValidateResult = await res.json();
      setValidateResult(result);
    } catch {
      setValidateResult({ valid: false, scope: 'not_found', hint: '验证失败，请重试' });
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, searchLoading]);

  // === 确认并添加目的地 ===
  const confirmDestination = useCallback(
    (name: string, lat: number, lng: number) => {
      const id = destinationSlug(name);

      // 检查是否已存在
      if (destinations.some(d => d.id === id)) {
        // 已存在，直接选中
        const existing = destinations.find(d => d.id === id);
        if (existing) setSelected(existing);
        setValidateResult(null);
        setSearchQuery('');
        return;
      }

      const newDest: Destination = {
        id,
        name,
        description: '',
        coordinates: { lat, lng },
        spots: [],
      };

      setDestinations(prev => [...prev, newDest]);
      setSelected(newDest);
      setValidateResult(null);
      setSearchQuery('');
    },
    [destinations]
  );

  // === 点击地图上的目的地光点 ===
  const handleDestinationClick = useCallback(
    (dest: Destination) => {
      setSelected(prev => (prev?.id === dest.id ? null : dest));
    },
    []
  );

  // === 换一批 ===
  const handleRefresh = useCallback(() => {
    setDisplayAttractions(pickRandom(allAttractions, 3));
    setDisplayCheckins(pickRandom(allCheckins, 3));
  }, [allAttractions, allCheckins]);

  // === 保存状态并跳转 ===
  const handlePlaceClick = useCallback(
    (placeId: string, destinationId: string, destinationName: string) => {
      // 保存当前状态
      if (selected) {
        saveMapState({
          selectedId: selected.id,
          aiDescription,
          allAttractions,
          allCheckins,
          displayAttractionIds: displayAttractions.map(p => p.id),
          displayCheckinIds: displayCheckins.map(p => p.id),
        });
      }
      const nameParam = destinationName ? `?name=${encodeURIComponent(destinationName)}` : '';
      router.push(`/visit/confirm/${destinationId}/${placeId}${nameParam}`);
    },
    [selected, aiDescription, allAttractions, allCheckins, displayAttractions, displayCheckins, router]
  );

  // === 返回首页 ===
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

        {/* 搜索框 — 地图上方浮动 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[340px] animate-fade-in-up">
          <div className="relative flex items-center bg-background/90 backdrop-blur-sm border border-border/40 rounded-lg shadow-sm">
            <Search className="w-4 h-4 text-muted-foreground/40 ml-3 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="你想去哪里？"
              className="flex-1 h-10 px-3 bg-transparent text-sm text-foreground/80 placeholder:text-muted-foreground/35 focus:outline-none"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setValidateResult(null); }}
                className="mr-1 p-1 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleSearch}
              disabled={searchLoading || !searchQuery.trim()}
              className="mr-2 px-3 h-7 text-xs text-accent-green bg-accent-green/8 border border-accent-green/15 rounded-md hover:bg-accent-green/15 transition-all duration-300 disabled:opacity-30"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {searchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '搜索'}
            </button>
          </div>

          {/* 验证结果提示 */}
          {validateResult && (
            <ValidateResultCard
              result={validateResult}
              onConfirm={confirmDestination}
              onDismiss={() => setValidateResult(null)}
            />
          )}
        </div>

        {/* 无目的地时的中央提示 */}
        {destinations.length === 0 && !validateResult && !searchLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
            <div className="text-center animate-fade-in-up">
              <p
                className="text-sm text-muted-foreground/25 tracking-[0.15em] mb-1"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                在上方搜索你想去的地方
              </p>
              <p className="text-[11px] text-muted-foreground/15 tracking-wider">
                国内目的地均可探索
              </p>
            </div>
          </div>
        )}

        {/* 底部面板：选中目的地的景点/打卡地 */}
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
                  <span
                    className="text-muted-foreground/30 tracking-wider animate-pulse"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    正在了解{selected.name}...
                  </span>
                ) : (
                  aiDescription
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
                  {attractionsLoading ? (
                    <p
                      className="text-[11px] text-muted-foreground/30 tracking-wider py-6 text-center animate-pulse"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      正在搜索{selected.name}的景点...
                    </p>
                  ) : displayAttractions.length > 0 ? (
                    <div className="space-y-2">
                      {displayAttractions.map(item => (
                        <PlaceCard
                          key={item.id}
                          item={item}
                          destinationId={selected.id}
                          destinationName={selected.name}
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
                  {checkinsLoading ? (
                    <p
                      className="text-[11px] text-muted-foreground/30 tracking-wider py-6 text-center animate-pulse"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      正在寻找{selected.name}的打卡地...
                    </p>
                  ) : displayCheckins.length > 0 ? (
                    <div className="space-y-2">
                      {displayCheckins.map(item => (
                        <PlaceCard
                          key={item.id}
                          item={item}
                          destinationId={selected.id}
                          destinationName={selected.name}
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
                {(allAttractions.length > 3 || allCheckins.length > 3) && (
                  <button
                    onClick={handleRefresh}
                    className="text-[11px] text-muted-foreground/35 hover:text-accent-green/70 transition-colors duration-300 tracking-wider"
                  >
                    换一批
                  </button>
                )}
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

/** 验证结果卡片 */
function ValidateResultCard({
  result,
  onConfirm,
  onDismiss,
}: {
  result: ValidateResult;
  onConfirm: (name: string, lat: number, lng: number) => void;
  onDismiss: () => void;
}) {
  if (result.valid && result.name && result.lat && result.lng) {
    return (
      <div className="mt-2 p-3 bg-background/95 backdrop-blur-sm border border-accent-green/20 rounded-lg animate-fade-in-up">
        <p
          className="text-sm text-foreground/75 mb-2"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          发现目的地：{result.name}
          {result.brief && (
            <span className="text-muted-foreground/40 ml-1">· {result.brief}</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(result.name!, result.lat!, result.lng!)}
            className="px-3 py-1.5 text-xs text-accent-green bg-accent-green/10 border border-accent-green/20 rounded-md hover:bg-accent-green/18 transition-all"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            出发去这里
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  if (result.scope === 'too_narrow' && result.suggestion) {
    const s = result.suggestion;
    return (
      <div className="mt-2 p-3 bg-background/95 backdrop-blur-sm border border-orange-400/20 rounded-lg animate-fade-in-up">
        <p
          className="text-sm text-foreground/70 mb-2"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {result.hint}
        </p>
        <p
          className="text-xs text-muted-foreground/50 mb-2"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          要不要探索
          <span className="text-accent-green mx-1">{s.name}</span>
          ？
          {s.brief && <span className="text-muted-foreground/30 ml-1">{s.brief}</span>}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(s.name, s.lat, s.lng)}
            className="px-3 py-1.5 text-xs text-accent-green bg-accent-green/10 border border-accent-green/20 rounded-md hover:bg-accent-green/18 transition-all"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            去{s.name}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
          >
            再想想
          </button>
        </div>
      </div>
    );
  }

  if (result.scope === 'too_broad' && result.suggestions) {
    return (
      <div className="mt-2 p-3 bg-background/95 backdrop-blur-sm border border-border/30 rounded-lg animate-fade-in-up">
        <p
          className="text-sm text-foreground/70 mb-3"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {result.hint}
        </p>
        <div className="space-y-2 mb-3">
          {result.suggestions.map(s => (
            <button
              key={s.name}
              onClick={() => onConfirm(s.name, s.lat, s.lng)}
              className="w-full text-left px-3 py-2 rounded-md border border-border/30 hover:border-accent-green/20 hover:bg-accent-green/5 transition-all"
            >
              <span
                className="text-sm text-foreground/75"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {s.name}
              </span>
              {s.brief && (
                <span className="text-[11px] text-muted-foreground/35 ml-2">{s.brief}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onDismiss}
          className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
        >
          再想想
        </button>
      </div>
    );
  }

  // not_found 或其他
  return (
    <div className="mt-2 p-3 bg-background/95 backdrop-blur-sm border border-border/30 rounded-lg animate-fade-in-up">
      <p
        className="text-sm text-muted-foreground/60"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {result.hint || '未找到该目的地'}
      </p>
      <button
        onClick={onDismiss}
        className="mt-2 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
      >
        重新搜索
      </button>
    </div>
  );
}

/** 地点卡片组件 */
function PlaceCard({
  item,
  destinationId,
  destinationName,
  onClick,
}: {
  item: PlaceItem;
  destinationId: string;
  destinationName: string;
  onClick: (placeId: string, destinationId: string, destinationName: string) => void;
}) {
  const handleClick = () => {
    onClick(item.id, destinationId, destinationName);
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
      <p className="text-[11px] text-muted-foreground/45 leading-relaxed">{item.description}</p>
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
