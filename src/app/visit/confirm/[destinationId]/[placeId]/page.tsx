'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { PlaceType, TimeSlot } from '@/lib/destinations';
import { authHeaders, getCachedGameTime, cacheGameTime } from '@/lib/auth';
import TimeTimeline from '@/components/time-timeline';

interface OngoingTour {
  placeId: string;
  placeName: string;
}

interface ConfirmPageProps {
  params: Promise<{
    destinationId: string;
    placeId: string;
  }>;
}

export default function VisitConfirmPage({ params }: ConfirmPageProps) {
  const routeParams = use(params);
  // Next.js 动态路由参数可能不会自动解码中文，需要手动 decodeURIComponent
  const destinationId = decodeURIComponent(routeParams.destinationId);
  const placeId = decodeURIComponent(routeParams.placeId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const destinationName = searchParams.get('name') ?? '';
  const totalPlaces = searchParams.get('total') ?? '0';
  const placeName = searchParams.get('placeName') ?? '';

  // 从 placeId 解析类型
  const placeType: PlaceType = placeId.includes('-checkin-') ? 'checkin' : 'attraction';
  const placeLabel = placeType === 'attraction' ? '景点' : '打卡地';

  // 随机事件数：景点 2~3，打卡地 1~2（使用 useState + useEffect 避免 hydration/purity 问题）
  const [eventCount, setEventCount] = useState<number | null>(null);
  // 同目的地未完成的游览
  const [ongoingTour, setOngoingTour] = useState<OngoingTour | null>(null);
  // 游戏时间（初始化从 localStorage 缓存读取，避免闪烁）
  const [gameDay, setGameDay] = useState(() => getCachedGameTime().gameDay);
  const [gameTimeSlot, setGameTimeSlot] = useState<TimeSlot>(() => getCachedGameTime().gameTimeSlot as TimeSlot);

  useEffect(() => {
    const count = placeType === 'attraction'
      ? (Math.random() < 0.5 ? 2 : 3)
      : (Math.random() < 0.5 ? 1 : 2);
    setEventCount(count);

    // 检查同目的地是否有未完成的游览
    fetch('/api/progress', { headers: authHeaders() })
      .then(res => res.json())
      .then(async data => {
        // 加载游戏时间（无论是否有 progress 都要加载）
        if (data.gameDay !== undefined) {
          setGameDay(data.gameDay);
          cacheGameTime(data.gameDay, data.gameTimeSlot ?? 1);
        }
        if (data.gameTimeSlot !== undefined) setGameTimeSlot(data.gameTimeSlot as TimeSlot);

        if (!data.progress) return;
        const destProgress = data.progress[destinationId];
        if (!destProgress?.touringState) return;
        const ts = destProgress.touringState;
        // 只关心未完成的、且不是当前地点的游览
        if (ts.completed || ts.placeId === placeId) return;
        // 使用 touringState 中的 placeName
        let pName = ts.placeName;
        // 如果 placeName 为空，从景点/打卡地 API 反查
        if (!pName) {
          try {
            const [attrRes, checkinRes] = await Promise.all([
              fetch('/api/destination/attractions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destinationId, destinationName }),
              }),
              fetch('/api/destination/checkins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destinationId, destinationName }),
              }),
            ]);
            const [attrData, checkinData] = await Promise.all([attrRes.json(), checkinRes.json()]);
            const allPlaces = [
              ...(attrData.data?.attractions ?? []),
              ...(checkinData.data?.checkins ?? []),
            ];
            const found = allPlaces.find((p: { id: string }) => p.id === ts.placeId);
            if (found) pName = found.name;
          } catch {
            // 反查失败，降级
          }
          pName = pName || '其他景点';
        }
        setOngoingTour({ placeId: ts.placeId, placeName: pName });
      })
      .catch(() => {});
  }, [destinationId, placeId, placeType]);

  const handleDepart = () => {
    if (eventCount === null) return;
    const nameParam = destinationName ? `&name=${encodeURIComponent(destinationName)}` : '';
    const placeParam = `&placeName=${encodeURIComponent(placeName)}`;
    router.push(
      `/visit/touring?destinationId=${destinationId}&placeId=${placeId}&events=${eventCount}&total=${totalPlaces}${nameParam}${placeParam}`
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部占位 — 与地图页 header 等高，保持时间线位置一致 */}
      <div className="w-full flex items-center justify-between px-6 py-3 border-b border-border/40 shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground/60 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* 时间线 — 与地图页/游览页同位置 */}
      <div className="flex justify-center py-1.5 bg-background/80 backdrop-blur-sm border-b border-border/20 shrink-0">
        <TimeTimeline day={gameDay} timeSlot={gameTimeSlot} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6">
        <div className="max-w-sm w-full text-center space-y-8 animate-fade-in-up">
        {/* 地点标识 */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-accent/50 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-accent-green" />
          </div>
        </div>

        {/* 确认信息 */}
        <div className="space-y-3">
          <h2
            className="text-xl font-light tracking-wider text-foreground/85"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            即将出发
          </h2>
          {eventCount !== null ? (
            <p className="text-sm text-muted-foreground/60 leading-relaxed">
              当前{placeLabel}将显示
              <span className="text-accent-green font-medium mx-1">{eventCount}</span>
              个随机事件
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/30">...</p>
          )}
        </div>

        {/* 未完成游览警告 */}
        {ongoingTour && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-yellow-50/80 border border-yellow-200/60 text-left">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <p
              className="text-xs text-yellow-800/70 leading-relaxed"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              你还在「<span className="text-yellow-900 font-medium">{ongoingTour.placeName}</span>」游览中，前往新地点将覆盖该景点的进度
            </p>
          </div>
        )}

        {/* 操作按钮区域 */}
        {ongoingTour ? (
          /* 有警告：返回为主按钮，仍要前往为弱化小字 */
          <div className="space-y-4">
            <button
              onClick={() => router.back()}
              className="w-full h-11 bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/18 hover:border-accent-green/35 transition-all duration-500 text-sm tracking-[0.08em] rounded-lg"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              返回
            </button>
            <button
              onClick={handleDepart}
              disabled={eventCount === null}
              className="text-xs text-muted-foreground/35 hover:text-muted-foreground/55 transition-colors duration-300 disabled:opacity-30"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              仍要前往
            </button>
          </div>
        ) : (
          /* 无警告：确认出发为主按钮，返回地图为弱化小字 */
          <div className="space-y-4">
            <button
              onClick={handleDepart}
              disabled={eventCount === null}
              className="w-full h-11 bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/18 hover:border-accent-green/35 transition-all duration-500 text-sm tracking-[0.08em] rounded-lg disabled:opacity-40"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              确认出发
            </button>
            <button
              onClick={() => router.back()}
              className="text-xs text-muted-foreground/35 hover:text-muted-foreground/55 transition-colors duration-300"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              返回地图
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
