'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Footprints, FastForward, Volume2, VolumeX } from 'lucide-react';
import { getStoredAuth, authHeaders } from '@/lib/auth';

/** 事件数据结构（含可选图片） */
interface EventData {
  text: string;
  imageUrl?: string;
}

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
  const destinationName = searchParams.get('name') ?? '';
  const placeId = searchParams.get('placeId') ?? '';
  const totalEvents = parseInt(searchParams.get('events') ?? '2', 10);

  // 事件状态
  const [events, setEvents] = useState<EventData[]>([]);
  const [pendingEvent, setPendingEvent] = useState<EventData | null>(null);
  const [displayedEvent, setDisplayedEvent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showingImage, setShowingImage] = useState<string | undefined>(undefined);

  // 计时状态
  const [intervalMs, setIntervalMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [showStroll, setShowStroll] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);

  // 事件是否全部完成
  const allDone = events.length >= totalEvents;

  // 背景音乐
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const totalPlaces = parseInt(searchParams.get('total') ?? '0', 10);
  const [muted, setMuted] = useState(false);

  // 初始化并播放背景音乐
  useEffect(() => {
    const audio = new Audio('/assets/touring-bgm.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    audio.play().catch(() => {
      // 浏览器自动播放限制，静音重试
      audio.muted = true;
      audio.play().then(() => {
        audio.muted = false;
        setMuted(false);
      }).catch(() => {});
    });

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // 静音切换
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
  }, [muted]);

  // 用 ref 跟踪最新值，避免闭包问题
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const timerStartRef = useRef(0);
  const intervalMsRef = useRef(0);
  const pendingEventRef = useRef<EventData | null>(null);
  pendingEventRef.current = pendingEvent;

  /** 请求下一个随机事件 */
  const fetchNextEvent = useCallback(async () => {
    try {
      const res = await fetch('/api/visit/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId,
          destinationName,
          placeId,
          previousEvents: eventsRef.current.map(e => e.text),
        }),
      });
      const data = await res.json();
      if (data.event) {
        const eventData: EventData = {
          text: data.event,
          imageUrl: data.imageUrl || undefined,
        };
        setPendingEvent(eventData);
      }
    } catch {
      setPendingEvent({
        text: '你沿着小路慢慢走着，光影从树叶间洒落，风里带着淡淡的花香。',
      });
    }
  }, [destinationId, destinationName, placeId]);

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

  /** 显示下个事件（打字机效果 + 图片淡入） */
  const showEvent = useCallback(
    (eventData: EventData) => {
      setIsWaiting(false);
      setShowStroll(false);
      setIsTyping(true);
      setDisplayedEvent('');
      setShowingImage(undefined);

      // 图片延迟淡入（在打字机开始后一小段时间）
      if (eventData.imageUrl) {
        setTimeout(() => {
          setShowingImage(eventData.imageUrl);
        }, 300);
      }

      let idx = 0;
      const timer = setInterval(() => {
        idx++;
        setDisplayedEvent(eventData.text.slice(0, idx));
        if (idx >= eventData.text.length) {
          clearInterval(timer);
          setIsTyping(false);
          setPendingEvent(null);
          setEvents(prev => [...prev, eventData]);
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
        const evt = pendingEventRef.current;
        if (evt) {
          showEvent(evt);
        }
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isWaiting, showEvent]);

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

  /** 返回地图，同时保存游览进度到服务器 */
  const goBackToMap = useCallback(async () => {
    const auth = getStoredAuth();
    if (auth) {
      try {
        // 先从服务器获取当前进度
        const res = await fetch('/api/progress', {
          headers: authHeaders(),
        });
        const data = await res.json();
        const currentVisited: string[] = data.progress?.[destinationId]?.visitedPlaceIds ?? [];

        // 添加当前已游览的地点
        const updatedVisited = [...new Set([...currentVisited, placeId])];

        // 保存回服务器
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            destinationSlug: destinationId,
            visitedPlaceIds: updatedVisited,
            totalPlaces,
          }),
        });
      } catch {
        // 保存失败不阻塞返回
      }
    }
    router.push('/map');
  }, [destinationId, placeId, router]);
  const handleStroll = () => {
    const evt = pendingEventRef.current;
    if (evt) {
      showEvent(evt);
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
          onClick={() => goBackToMap()}
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
        <button
          onClick={toggleMute}
          className="text-muted-foreground/50 hover:text-foreground/60 transition-colors duration-300"
          aria-label={muted ? '取消静音' : '静音'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </header>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="max-w-sm w-full space-y-8">
          {/* 已完成事件列表 */}
          {events.length > 0 && (
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div key={i} className="space-y-2">
                  {ev.imageUrl && (
                    <div className="w-full rounded-lg overflow-hidden opacity-70">
                      <img
                        src={ev.imageUrl}
                        alt=""
                        className="w-full h-auto object-cover rounded-lg"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div
                    className="text-sm text-muted-foreground/55 leading-relaxed pl-4 border-l-2 border-accent-green/20"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {ev.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 当前事件（打字机 + 图片淡入） */}
          {isTyping && !isWaiting && (
            <div className="space-y-2">
              {showingImage && (
                <div className="w-full rounded-lg overflow-hidden animate-fade-in-up">
                  <img
                    src={showingImage}
                    alt=""
                    className="w-full h-auto object-cover rounded-lg"
                  />
                </div>
              )}
              <div
                className="text-sm text-foreground/75 leading-relaxed pl-4 border-l-2 border-accent-green/40"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {displayedEvent}
                <span className="inline-block w-px h-[1em] align-middle bg-muted-foreground/40 ml-0.5 animate-blink" />
              </div>
            </div>
          )}

          {/* 等待中状态 */}
          {isWaiting && !allDone && (
            <div className="text-center space-y-4 animate-fade-in-up">
              <p
                className="text-xs text-muted-foreground/35 tracking-wider"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {pendingEvent?.imageUrl ? '摄影中...' : '漫步中...'}
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
                onClick={() => goBackToMap()}
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
