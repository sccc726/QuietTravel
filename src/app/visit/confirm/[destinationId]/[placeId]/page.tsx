'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { PlaceType } from '@/lib/destinations';

interface ConfirmPageProps {
  params: Promise<{
    destinationId: string;
    placeId: string;
  }>;
}

export default function VisitConfirmPage({ params }: ConfirmPageProps) {
  const { destinationId, placeId } = use(params);
  const router = useRouter();

  // 从 placeId 解析类型
  const placeType: PlaceType = placeId.includes('-checkin-') ? 'checkin' : 'attraction';
  const placeLabel = placeType === 'attraction' ? '景点' : '打卡地';

  // 随机事件数：景点 2~3，打卡地 1~2（使用 useState + useEffect 避免 hydration/purity 问题）
  const [eventCount, setEventCount] = useState<number | null>(null);

  useEffect(() => {
    const count = placeType === 'attraction'
      ? (Math.random() < 0.5 ? 2 : 3)
      : (Math.random() < 0.5 ? 1 : 2);
    setEventCount(count);
  }, [placeType]);

  const handleDepart = () => {
    if (eventCount === null) return;
    // 跳转到游览中页面，携带事件数
    router.push(
      `/visit/touring?destinationId=${destinationId}&placeId=${placeId}&events=${eventCount}`
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-8 animate-fade-in-up">
        {/* 返回按钮 */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground/60 transition-colors duration-300 mx-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span style={{ fontFamily: 'var(--font-serif)' }}>返回</span>
        </button>

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

        {/* 出发按钮 */}
        <button
          onClick={handleDepart}
          disabled={eventCount === null}
          className="w-full h-11 bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/18 hover:border-accent-green/35 transition-all duration-500 text-sm tracking-[0.08em] rounded-lg disabled:opacity-40"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          确认出发
        </button>
      </div>
    </div>
  );
}
