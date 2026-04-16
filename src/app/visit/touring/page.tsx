'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Footprints, FastForward } from 'lucide-react';

/** 生成随机间隔时间（20~60分钟，单位毫秒） */
function randomInterval(): number {
  const minMs = 20 * 60 * 1000;
  const maxMs = 60 * 60 * 1000;
  return minMs + Math.random() * (maxMs - minMs);
}

/** 格式化剩余时间为 mm:ss */
function formatTime(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function TouringContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destinationId = searchParams.get('destinationId') ?? '';
  const placeId = searchParams.get('placeId') ?? '';
  const totalEvents = parseInt(searchParams.get('events') ?? '2', 10);

  // 事件状态
  const [events, setEvents] = useState<string[]>([]);
  const [currentEvent, setCurrentEvent] = useState<string>('');
  const [displayedEvent, setDisplayedEvent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // 计时状态
  const [intervalMs, setIntervalMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [showStroll, setShowStroll] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);

  // 事件是否全部完成
  const allDone = events.length >= totalEvents;

  // 用 ref 跟踪最新值，避免闭包问题
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const timerStartRef = useRef(0);
  const intervalMsRef = useRef(0);

  /** 请求下一个随机事件 */
  const fetchNextEvent = useCallback(async () => {
    try {
      const res = await fetch('/api/visit/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId,
          placeId,
          previousEvents: eventsRef.current,
        }),
      });
      const data = await res.json();
      if (data.event) {
        setCurrentEvent(data.event);
      }
    } catch {
      setCurrentEvent('你沿着小路慢慢走着，光影从树叶间洒落，风里带着淡淡的花香。');
    }
  }, [destinationId, placeId]);

  /** 开始一段新的等待计时 */
  const startWaiting = useCallback(() => {
    const interval = randomInterval();
    setIntervalMs(interval);
    setRemainingMs(interval);
    setShowStroll(false);
    setIsWaiting(true);
    timerStartRef.current = Date.now();
    intervalMsRef.current = interval;
  }, []);

  /** 显示下个事件（打字机效果） */
  const showEvent = useCallback(
    (eventText: string) => {
      setIsWaiting(false);
      setShowStroll(false);
      setIsTyping(true);
      setDisplayedEvent('');

      let idx = 0;
      const timer = setInterval(() => {
        idx++;
        setDisplayedEvent(eventText.slice(0, idx));
        if (idx >= eventText.length) {
          clearInterval(timer);
          setIsTyping(false);
          setCurrentEvent(''); // 清空当前事件，避免和已完成列表重复显示
          setEvents(prev => [...prev, eventText]);
        }
      }, 50);
    },
    []
  );

  // 初始化：获取第一个事件
  useEffect(() => {
    if (!destinationId || !placeId) return;
    fetchNextEvent();
    startWaiting();
  }, [destinationId, placeId, fetchNextEvent, startWaiting]);

  // 倒计时
  useEffect(() => {
    if (!isWaiting) return;

    const tick = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current;
      const remaining = intervalMsRef.current - elapsed;
      setRemainingMs(Math.max(0, remaining));

      // 剩余 20% 时显示"随意逛逛"
      if (remaining <= intervalMsRef.current * 0.2 && remaining > 0) {
        setShowStroll(true);
      }

      // 时间到，触发事件
      if (remaining <= 0) {
        clearInterval(tick);
        if (currentEvent) {
          showEvent(currentEvent);
        }
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isWaiting, currentEvent, showEvent]);

  // 事件显示完毕后：如果还有下一个，开始新计时
  useEffect(() => {
    if (isTyping || isWaiting || allDone) return;

    if (events.length < totalEvents) {
      // 还需更多事件
      const timer = setTimeout(() => {
        fetchNextEvent();
        startWaiting();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [events.length, isTyping, isWaiting, allDone, totalEvents, fetchNextEvent, startWaiting]);

  /** "随意逛逛" — 立即显示事件 */
  const handleStroll = () => {
    if (currentEvent) {
      showEvent(currentEvent);
    }
  };

  /** 测试用：跳转时间到间隔的 85% 处（即剩余 15%） */
  const handleFastForward = () => {
    const targetElapsed = intervalMsRef.current * 0.85;
    timerStartRef.current = Date.now() - targetElapsed;
    intervalMsRef.current = intervalMsRef.current; // 保持不变
    const newRemaining = intervalMsRef.current - targetElapsed;
    setRemainingMs(newRemaining);
    setShowStroll(true); // 15% < 20%，触发显示
  };

  const progress = intervalMs > 0 ? ((intervalMs - remainingMs) / intervalMs) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border/40 shrink-0">
        <button
          onClick={() => router.push(`/map?visited=${encodeURIComponent(placeId)}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground/60 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span style={{ fontFamily: 'var(--font-serif)' }}>返回地图</span>
        </button>
        <h1
          className="text-sm font-light tracking-[0.08em] text-foreground/70"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          游览中
        </h1>
        <div className="w-16" />
      </header>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="max-w-sm w-full space-y-8">
          {/* 已完成事件列表 */}
          {events.length > 0 && (
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div
                  key={i}
                  className="text-sm text-muted-foreground/55 leading-relaxed pl-4 border-l-2 border-accent-green/20"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {ev}
                </div>
              ))}
            </div>
          )}

          {/* 当前事件（打字机） */}
          {isTyping && !isWaiting && (
            <div
              className="text-sm text-foreground/75 leading-relaxed pl-4 border-l-2 border-accent-green/40"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {displayedEvent}
              <span className="inline-block w-px h-[1em] align-middle bg-muted-foreground/40 ml-0.5 animate-blink" />
            </div>
          )}

          {/* 等待中状态 */}
          {isWaiting && !allDone && (
            <div className="text-center space-y-4 animate-fade-in-up">
              <p
                className="text-xs text-muted-foreground/35 tracking-wider"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                漫步中...
              </p>

              {/* 进度条 */}
              <div className="w-full h-px bg-border/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-green/30 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p
                className="text-xs text-muted-foreground/25 tracking-wider font-mono"
              >
                {formatTime(remainingMs)}
              </p>
            </div>
          )}

          {/* 全部完成 */}
          {allDone && !isTyping && (
            <div className="text-center space-y-4 animate-fade-in-up">
              <p
                className="text-sm text-accent-green/70 tracking-wider"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                此次游览结束
              </p>
              <button
                onClick={() => router.push(`/map?visited=${encodeURIComponent(placeId)}`)}
                className="text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors duration-300 tracking-wider"
              >
                返回地图
              </button>
            </div>
          )}

          {/* 操作按钮区 */}
          <div className="flex items-center justify-center gap-3">
            {/* 随意逛逛 */}
            {showStroll && isWaiting && (
              <button
                onClick={handleStroll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green/10 border border-accent-green/20 text-accent-green text-xs tracking-wider hover:bg-accent-green/18 transition-all duration-300 animate-fade-in-up"
              >
                <Footprints className="w-3.5 h-3.5" />
                随意逛逛
              </button>
            )}

            {/* 测试用：跳转时间 */}
            {isWaiting && !allDone && (
              <button
                onClick={handleFastForward}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-muted-foreground/40 text-[11px] tracking-wider hover:text-muted-foreground/60 hover:bg-muted/50 transition-all duration-300"
              >
                <FastForward className="w-3 h-3" />
                跳转时间
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TouringPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-sm text-muted-foreground/30">加载中...</p>
        </div>
      }
    >
      <TouringContent />
    </Suspense>
  );
}
