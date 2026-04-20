'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Footprints, FastForward, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { getStoredAuth, authHeaders } from '@/lib/auth';

/** 事件数据结构（含可选图片） */
interface EventData {
  text: string;
  imageUrl?: string;
}

/** 游览状态（持久化到服务端） */
interface TouringState {
  destinationId: string;
  destinationName: string;
  placeId: string;
  placeName: string;      // 地点名称（用于确认页警告显示）
  totalEvents: number;
  completedEvents: number;
  timerStartAt: number;   // 当前倒计时起始时间戳（ms）
  intervalMs: number;     // 当前倒计时间隔（ms）
  hasImage: boolean;      // 当前地点是否已生成过图片
  totalPlaces: number;    // 目的地总地点数（用于跳转URL参数）
  completed: boolean;     // 游览是否已完成
  events: EventData[];    // 已生成的事件列表
  lastSavedAt: number;    // 最后保存时间戳（ms）
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

/** 平均间隔（用于估算恢复时错过的事件数） */
const AVG_INTERVAL_MS = 40 * 60 * 1000;
/** 最大恢复时间（4小时），超过视为游览结束 */
const MAX_RECOVERY_MS = 4 * 60 * 60 * 1000;

function TouringContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destinationId = searchParams.get('destinationId') ?? '';
  const destinationName = searchParams.get('name') ?? '';
  const placeId = searchParams.get('placeId') ?? '';
  const placeName = searchParams.get('placeName') ?? '';
  const totalEvents = parseInt(searchParams.get('events') ?? '2', 10);
  const totalPlaces = parseInt(searchParams.get('total') ?? '0', 10);

  // 页面模式：'active' | 'completed'
  const [mode, setMode] = useState<'loading' | 'active' | 'completed'>('loading');

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

  // 恢复状态
  const [restoringText, setRestoringText] = useState('');

  // hasImage 跟踪（每个地点最多1张图）
  const [hasImage, setHasImage] = useState(false);

  // 事件是否全部完成
  const allDone = events.length >= totalEvents;

  // 背景音乐
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  // 用 ref 跟踪最新值，避免闭包问题
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const timerStartRef = useRef(0);
  const intervalMsRef = useRef(0);
  const pendingEventRef = useRef<EventData | null>(null);
  pendingEventRef.current = pendingEvent;
  const hasImageRef = useRef(false);
  hasImageRef.current = hasImage;
  const totalEventsRef = useRef(totalEvents);
  totalEventsRef.current = totalEvents;
  const totalPlacesRef = useRef(totalPlaces);
  totalPlacesRef.current = totalPlaces;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // 是否已初始化（防止重复执行）
  const initializedRef = useRef(false);

  // ─── 游览状态持久化 ───────────────────────────────

  /** 保存游览状态到服务端 */
  const saveTouringState = useCallback(async (override?: Partial<TouringState>) => {
    const auth = getStoredAuth();
    if (!auth) return;

    const state: TouringState = {
      destinationId,
      destinationName,
      placeId,
      placeName,
      totalEvents,
      completedEvents: override?.completedEvents ?? eventsRef.current.length,
      timerStartAt: override?.timerStartAt ?? timerStartRef.current,
      intervalMs: override?.intervalMs ?? intervalMsRef.current,
      hasImage: override?.hasImage ?? hasImageRef.current,
      totalPlaces: override?.totalPlaces ?? totalPlacesRef.current,
      completed: override?.completed ?? modeRef.current === 'completed',
      events: override?.events ?? eventsRef.current,
      lastSavedAt: Date.now(),
    };

    try {
      await fetch('/api/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          destinationSlug: destinationId,
          touringState: state,
        }),
      });
    } catch {
      // 静默失败，不影响用户体验
    }
  }, [destinationId, destinationName, placeId, totalEvents]);

  /** 清除服务端游览状态 */
  const clearTouringState = useCallback(async () => {
    const auth = getStoredAuth();
    if (!auth) return;

    try {
      await fetch('/api/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          destinationSlug: destinationId,
          touringState: null,
        }),
      });
    } catch {
      // 静默失败
    }
  }, [destinationId]);

  // ─── 背景音乐 ─────────────────────────────────────

  useEffect(() => {
    const audio = new Audio('/assets/touring-bgm.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;

    audio.play().catch(() => {
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

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
  }, [muted]);

  // ─── 事件获取 ─────────────────────────────────────

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
          hasImage: hasImageRef.current,
        }),
      });
      const data = await res.json();
      if (data.event) {
        const eventData: EventData = {
          text: data.event,
          imageUrl: data.imageUrl || undefined,
        };
        setPendingEvent(eventData);
        // 如果生成了图片，标记 hasImage
        if (data.imageUrl) {
          setHasImage(true);
        }
      }
    } catch {
      setPendingEvent({
        text: '你沿着小路慢慢走着，光影从树叶间洒落，风里带着淡淡的花香。',
      });
    }
  }, [destinationId, destinationName, placeId]);

  /** 批量获取事件（恢复用） */
  const fetchBatchEvents = useCallback(async (count: number): Promise<EventData[]> => {
    try {
      const res = await fetch('/api/visit/events-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId,
          destinationName,
          placeId,
          count,
          hasImage: hasImageRef.current,
        }),
      });
      const data = await res.json();
      if (data.events && Array.isArray(data.events)) {
        return data.events.map((text: string) => ({ text }));
      }
    } catch {
      // 降级
    }
    // 降级：返回默认事件
    return Array.from({ length: count }, () => ({
      text: '你沿着小路慢慢走着，光影从树叶间洒落，风里带着淡淡的花香。这一刻，什么都不用想。',
    }));
  }, [destinationId, destinationName, placeId]);

  // ─── 计时控制 ─────────────────────────────────────

  /** 开始一段新的等待计时 */
  const startWaiting = useCallback((interval?: number) => {
    const iv = interval ?? randomInterval();
    setIntervalMs(iv);
    setRemainingMs(iv);
    setShowStroll(false);
    setIsWaiting(true);
    timerStartRef.current = Date.now();
    intervalMsRef.current = iv;
    // 保存状态
    saveTouringState({ timerStartAt: Date.now(), intervalMs: iv });
  }, [saveTouringState]);

  /** 显示事件（打字机效果 + 图片淡入） */
  const showEvent = useCallback(
    (eventData: EventData, typingSpeed = 50) => {
      setIsWaiting(false);
      setShowStroll(false);
      setIsTyping(true);
      setDisplayedEvent('');
      setShowingImage(undefined);

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
          setEvents(prev => {
            const next = [...prev, eventData];
            // 更新完成事件数后保存状态
            saveTouringState({ completedEvents: next.length, events: next });
            return next;
          });
        }
      }, typingSpeed);
    },
    [saveTouringState]
  );

  // ─── 初始化：尝试恢复游览状态 ─────────────────────

  useEffect(() => {
    if (initializedRef.current) return;
    if (!destinationId || !placeId) return;
    initializedRef.current = true;

    const tryRestore = async () => {
      const auth = getStoredAuth();
      if (!auth) {
        // 未登录，正常初始化（无 loading 闪现）
        setMode('active');
        fetchNextEvent();
        startWaiting();
        return;
      }

      try {
        const res = await fetch('/api/progress', { headers: authHeaders() });
        const data = await res.json();
        const state: TouringState | null = data.progress?.[destinationId]?.touringState ?? null;

        if (!state || state.placeId !== placeId || state.destinationId !== destinationId) {
          // 没有匹配的游览状态，正常初始化（无 loading 闪现）
          setMode('active');
          fetchNextEvent();
          startWaiting();
          return;
        }

        // ─── 已完成的游览：显示"已来过"视图 ───
        if (state.completed) {
          setEvents(state.events ?? []);
          setMode('completed');
          return;
        }

        // ─── 进行中的游览：恢复 ───

        // 补全 placeName（历史数据可能为空），触发一次保存
        if (!state.placeName && placeName) {
          state.placeName = placeName;
          saveTouringState();
        }

        // 找到匹配的游览状态，计算恢复逻辑
        setRestoringText('恢复游览进度...');
        const elapsed = Date.now() - state.timerStartAt;
        const missedCount = Math.min(
          Math.floor(elapsed / AVG_INTERVAL_MS),
          state.totalEvents - state.completedEvents
        );

        // 恢复 hasImage 状态
        if (state.hasImage) {
          setHasImage(true);
        }

        // 先恢复已有事件
        if (state.events && state.events.length > 0) {
          setEvents(state.events);
        }

        if (elapsed > MAX_RECOVERY_MS || state.completedEvents + missedCount >= state.totalEvents) {
          // 时间太久或所有事件都已"完成"，直接结束游览
          setRestoringText('游览已结束，正在记录...');
          // 生成所有剩余事件（快速显示）
          const remainingCount = state.totalEvents - state.completedEvents;
          let finalEvents = [...(state.events ?? [])];
          if (remainingCount > 0) {
            const batchEvents = await fetchBatchEvents(remainingCount);
            finalEvents = [...finalEvents, ...batchEvents];
          }
          setEvents(finalEvents);
          setMode('completed');
          // 保存完成状态
          await saveTouringState({ completed: true, completedEvents: state.totalEvents, events: finalEvents });
          return;
        }

        if (missedCount > 0) {
          // 有错过的事件，批量生成并逐条添加
          setRestoringText(`恢复中，生成${missedCount}条见闻...`);
          const batchEvents = await fetchBatchEvents(missedCount);
          const restoredEvents = [...(state.events ?? []), ...batchEvents];
          setEvents(restoredEvents);
        }

        setMode('active');

        // 恢复剩余倒计时
        const nextIntervalStart = state.timerStartAt + missedCount * AVG_INTERVAL_MS;
        const timeSinceLastEvent = Date.now() - nextIntervalStart;
        const remainingInterval = Math.max(0, state.intervalMs - timeSinceLastEvent);

        if (state.completedEvents + missedCount >= state.totalEvents) {
          // 所有事件已完成，不用再计时
          return;
        }

        // 还有事件要生成，开始倒计时
        if (remainingInterval <= 0) {
          // 倒计时已结束，立即触发下一个事件
          fetchNextEvent();
          startWaiting();
        } else {
          // 从剩余时间继续倒计时
          setIntervalMs(state.intervalMs);
          setRemainingMs(remainingInterval);
          setShowStroll(remainingInterval <= state.intervalMs * 0.2);
          setIsWaiting(true);
          timerStartRef.current = Date.now() - (state.intervalMs - remainingInterval);
          intervalMsRef.current = state.intervalMs;
          // 预加载下一个事件
          fetchNextEvent();
        }

        // 保存恢复后的状态
        await saveTouringState({
          completedEvents: state.completedEvents + missedCount,
          timerStartAt: timerStartRef.current,
          intervalMs: intervalMsRef.current,
        });
      } catch {
        // 恢复失败，正常初始化
        setMode('active');
        fetchNextEvent();
        startWaiting();
      }
    };

    tryRestore();
  }, [destinationId, placeId, destinationName, fetchNextEvent, startWaiting, fetchBatchEvents, saveTouringState]);

  // ─── 倒计时 ───────────────────────────────────────

  useEffect(() => {
    if (mode !== 'active') return;
    if (!isWaiting) return;

    const tick = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current;
      const remaining = intervalMsRef.current - elapsed;
      setRemainingMs(Math.max(0, remaining));

      if (remaining <= intervalMsRef.current * 0.2 && remaining > 0) {
        setShowStroll(true);
      }

      if (remaining <= 0) {
        clearInterval(tick);
        const evt = pendingEventRef.current;
        if (evt) {
          showEvent(evt);
        }
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isWaiting, mode, showEvent]);

  // ─── 事件完毕后：继续下一个或标记完成 ──────────────

  useEffect(() => {
    if (mode !== 'active') return;
    if (isTyping || isWaiting || allDone) return;

    if (events.length < totalEvents) {
      const timer = setTimeout(() => {
        fetchNextEvent();
        startWaiting();
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 所有事件完成，标记游览结束
    setMode('completed');
    saveTouringState({ completed: true, completedEvents: events.length, events });
  }, [events.length, isTyping, isWaiting, allDone, mode, totalEvents, fetchNextEvent, startWaiting, saveTouringState]);

  // ─── 定期保存状态（每 30 秒）─────────────────────

  useEffect(() => {
    if (mode !== 'active') return;

    const interval = setInterval(() => {
      saveTouringState();
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [mode, saveTouringState]);

  // ─── 页面离开前保存状态 ──────────────────────────

  useEffect(() => {
    const handleBeforeUnload = () => {
      const auth = getStoredAuth();
      if (!auth) return;
      const state: TouringState = {
        destinationId,
        destinationName,
        placeId,
        placeName,
        totalEvents,
        completedEvents: eventsRef.current.length,
        timerStartAt: timerStartRef.current,
        intervalMs: intervalMsRef.current,
        hasImage: hasImageRef.current,
        totalPlaces: totalPlacesRef.current,
        completed: modeRef.current === 'completed',
        events: eventsRef.current,
        lastSavedAt: Date.now(),
      };
      // fetch + keepalive 可带自定义 header，替代 sendBeacon
      fetch('/api/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          destinationSlug: destinationId,
          touringState: state,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [destinationId, destinationName, placeId, totalEvents]);

  // ─── 返回地图 ─────────────────────────────────────

  const goBackToMap = useCallback(async () => {
    const auth = getStoredAuth();
    if (auth) {
      try {
        // 获取当前进度
        const res = await fetch('/api/progress', { headers: authHeaders() });
        const data = await res.json();
        const currentVisited: string[] = data.progress?.[destinationId]?.visitedPlaceIds ?? [];

        // 只有游览完成时才加入已游览列表
        const isCompleted = eventsRef.current.length >= totalEvents;
        const updatedVisited = isCompleted
          ? [...new Set([...currentVisited, placeId])]
          : currentVisited;

        // 保存进度，并标记游览完成（而非清除 touringState）
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            destinationSlug: destinationId,
            visitedPlaceIds: updatedVisited,
            totalPlaces,
            touringState: {
              destinationId,
              destinationName,
              placeId,
              placeName,
              totalEvents,
              completedEvents: eventsRef.current.length,
              timerStartAt: timerStartRef.current,
              intervalMs: intervalMsRef.current,
              hasImage: hasImageRef.current,
              totalPlaces,
              completed: eventsRef.current.length >= totalEvents,
              events: eventsRef.current,
              lastSavedAt: Date.now(),
            },
          }),
        });
      } catch {
        // 保存失败不阻塞返回
      }
    }
    router.push('/map');
  }, [destinationId, destinationName, placeId, router, totalEvents, totalPlaces]);

  // ─── 重新游览 ─────────────────────────────────────

  const handleRestart = useCallback(async () => {
    // 清除游览状态
    await clearTouringState();
    // 重置所有状态
    setEvents([]);
    setPendingEvent(null);
    setDisplayedEvent('');
    setIsTyping(false);
    setShowingImage(undefined);
    setIntervalMs(0);
    setRemainingMs(0);
    setShowStroll(false);
    setIsWaiting(true);
    setHasImage(false);
    setMode('active');
    // 开始新游览
    fetchNextEvent();
    startWaiting();
  }, [clearTouringState, fetchNextEvent, startWaiting]);

  // ─── 交互处理 ─────────────────────────────────────

  const handleStroll = () => {
    const evt = pendingEventRef.current;
    if (evt) {
      showEvent(evt);
    }
  };

  const handleFastForward = () => {
    const targetElapsed = intervalMsRef.current * 0.85;
    timerStartRef.current = Date.now() - targetElapsed;
    const newRemaining = intervalMsRef.current - targetElapsed;
    setRemainingMs(newRemaining);
    setShowStroll(true);
  };

  const progress = intervalMs > 0 ? ((intervalMs - remainingMs) / intervalMs) * 100 : 0;

  // ─── 渲染 ─────────────────────────────────────────

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
          {mode === 'completed' ? '游记' : '游览中'}
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

          {/* ═══ loading 模式（仅恢复时显示文字） ═══ */}
          {mode === 'loading' && restoringText && (
            <div className="text-center space-y-3">
              <p
                className="text-xs text-muted-foreground/40 tracking-wider"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {restoringText}
              </p>
            </div>
          )}

          {/* ═══ completed 模式：已来过视图 ═══ */}
          {mode === 'completed' && (
            <div className="space-y-8 animate-fade-in-up">
              {/* 标题 */}
              <div className="text-center space-y-2">
                <p
                  className="text-sm text-accent-green/70 tracking-wider"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  你已经来过这里啦
                </p>
                <p
                  className="text-xs text-muted-foreground/35 tracking-wider"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  这是上次的游记
                </p>
              </div>

              {/* 历史事件列表 */}
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

              {/* 底部按钮 */}
              <div className="flex flex-col items-center gap-3 pt-4">
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green/10 border border-accent-green/20 text-accent-green text-xs tracking-wider hover:bg-accent-green/18 transition-all duration-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  重新游览
                </button>
                <button
                  onClick={() => goBackToMap()}
                  className="text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors duration-300 tracking-wider"
                >
                  返回地图
                </button>
              </div>
            </div>
          )}

          {/* ═══ active 模式：游览中 ═══ */}
          {mode === 'active' && (
            <>
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

                  <p className="text-xs text-muted-foreground/25 tracking-wider font-mono">
                    {formatTime(remainingMs)}
                  </p>
                </div>
              )}

              {/* 操作按钮区 */}
              <div className="flex items-center justify-center gap-3">
                {showStroll && isWaiting && (
                  <button
                    onClick={handleStroll}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green/10 border border-accent-green/20 text-accent-green text-xs tracking-wider hover:bg-accent-green/18 transition-all duration-300 animate-fade-in-up"
                  >
                    <Footprints className="w-3.5 h-3.5" />
                    随意逛逛
                  </button>
                )}

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
            </>
          )}
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
