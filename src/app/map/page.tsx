'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
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

/** 从数组中随机取 n 条 */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export default function MapPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Destination | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(false);

  // 景点和打卡地数据
  const [allAttractions, setAllAttractions] = useState<PlaceItem[]>([]);
  const [allCheckins, setAllCheckins] = useState<PlaceItem[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  // 每次选中目的地时，随机挑选 3 条显示
  const displayAttractions = useMemo(
    () => (allAttractions.length > 0 ? pickRandom(allAttractions, 3) : []),
    [allAttractions, selected?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const displayCheckins = useMemo(
    () => (allCheckins.length > 0 ? pickRandom(allCheckins, 3) : []),
    [allCheckins, selected?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 选中目的地时：获取 AI 描述 + 景点 + 打卡地
  useEffect(() => {
    if (!selected) {
      setAiDescription('');
      setAllAttractions([]);
      setAllCheckins([]);
      return;
    }

    let cancelled = false;

    async function loadDestination(dest: Destination) {
      // 并行请求：描述 + 景点 + 打卡地
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
          if (data.data?.attractions) setAllAttractions(data.data.attractions);
        } catch { /* ignore */ }
      }

      // 处理打卡地
      if (checkinRes.status === 'fulfilled') {
        try {
          const data = await checkinRes.value.json();
          if (data.data?.checkins) setAllCheckins(data.data.checkins);
        } catch { /* ignore */ }
      }

      setPlacesLoading(false);
    }

    loadDestination(selected);

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const handleDestinationClick = useCallback((dest: Destination) => {
    setSelected(prev => (prev?.id === dest.id ? null : dest));
  }, []);

  /** 刷新：重新随机挑选 */
  const handleRefresh = useCallback(() => {
    // 触发 useMemo 重新计算：通过微调 allAttractions 引用
    setAllAttractions(prev => [...prev]);
    setAllCheckins(prev => [...prev]);
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm z-20 shrink-0 animate-fade-in-up">
        <button
          onClick={() => router.push('/')}
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
                        <PlaceCard key={item.id} item={item} destinationId={selected.id} />
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
                        <PlaceCard key={item.id} item={item} destinationId={selected.id} />
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
function PlaceCard({ item, destinationId }: { item: PlaceItem; destinationId: string }) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/visit/confirm/${destinationId}/${item.id}`);
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
