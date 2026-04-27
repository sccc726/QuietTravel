'use client';

import { TimeSlot, timeSlotName, isSpecialSlot, ALL_TIME_SLOTS } from '@/lib/destinations';

interface TimeTimelineProps {
  day: number;
  timeSlot: TimeSlot;
  money?: number;
  mood?: number;
  /** 紧凑模式，不显示天数文字 */
  compact?: boolean;
}

/** 时间线组件 — 心境(左) · 时间线(中) · 金钱(右) */
export default function TimeTimeline({ day, timeSlot, money, mood, compact = false }: TimeTimelineProps) {
  const labels: Record<TimeSlot, string> = {
    [TimeSlot.dawn]: '拂晓',
    [TimeSlot.morning1]: '清晨',
    [TimeSlot.morning2]: '早上',
    [TimeSlot.morning3]: '上午',
    [TimeSlot.noon]: '中午',
    [TimeSlot.afternoon]: '下午',
    [TimeSlot.evening]: '傍晚',
    [TimeSlot.night]: '晚上',
    [TimeSlot.latenight]: '深夜',
  };

  const LINE_W = 20;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {!compact && (
        <div className="text-[10px] text-muted-foreground/50 tracking-widest" style={{ fontFamily: 'var(--font-serif)' }}>
          第{day}天 · {timeSlotName(timeSlot)}
        </div>
      )}

      {/* 圆点行 — 心境(左贴边) + 时间线圆点(居中) + 金钱(右贴边) */}
      <div className="flex items-center w-full">
        {/* 心境 — 左侧贴边 */}
        {mood !== undefined ? (
          <div className="flex items-center gap-0.5 shrink-0" title="心境">
            <span className="text-[9px] leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'oklch(0.6 0.08 340 / 70%)' }}>
              ♥
            </span>
            <span className="text-[10px] leading-none tabular-nums" style={{ fontFamily: 'var(--font-serif)', color: 'oklch(0.5 0.06 340 / 65%)' }}>
              {mood}
            </span>
          </div>
        ) : <div />}

        {/* 时间线圆点 — 居中 */}
        <div className="flex-1 flex items-center justify-center">
          {ALL_TIME_SLOTS.map((slot, idx) => {
            const isCurrent = slot === timeSlot;
            const isPast = slot < timeSlot;
            const isSpecial = isSpecialSlot(slot);
            const nodeSize = isSpecial ? 5 : 7;
            const glowSize = isSpecial ? 12 : 16;

            return (
              <div key={slot} className="flex items-center">
                {idx > 0 && (
                  <div className="h-px bg-muted-foreground/15" style={{ width: LINE_W }} />
                )}
                <div className="relative flex items-center justify-center" style={{ width: nodeSize, height: nodeSize }}>
                  {isCurrent && (
                    <div
                      className="absolute rounded-full animate-pulse"
                      style={{
                        width: glowSize,
                        height: glowSize,
                        background: 'oklch(0.55 0.10 60 / 25%)',
                      }}
                    />
                  )}
                  <div
                    className="relative rounded-full transition-all duration-300"
                    style={{
                      width: nodeSize,
                      height: nodeSize,
                      background: isCurrent
                        ? 'oklch(0.45 0.08 55)'
                        : isPast
                          ? 'oklch(0.65 0.02 90)'
                          : 'transparent',
                      border: isCurrent
                        ? 'none'
                        : isPast
                          ? 'none'
                          : '1px solid oklch(0.70 0.02 90 / 50%)',
                      boxShadow: isCurrent
                        ? '0 0 6px oklch(0.45 0.08 55 / 50%)'
                        : 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 金钱 — 右侧贴边 */}
        {money !== undefined ? (
          <div className="flex items-center gap-0.5 shrink-0" title="金钱">
            <span className="text-[9px] leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'oklch(0.6 0.08 85 / 70%)' }}>
              ◆
            </span>
            <span className="text-[10px] leading-none tabular-nums" style={{ fontFamily: 'var(--font-serif)', color: 'oklch(0.5 0.06 85 / 65%)' }}>
              {money}
            </span>
          </div>
        ) : <div />}
      </div>

      {/* 标签行 */}
      <div className="flex items-start">
        {ALL_TIME_SLOTS.map((slot, idx) => {
          const isCurrent = slot === timeSlot;
          const isPast = slot < timeSlot;
          const isSpecial = isSpecialSlot(slot);
          const nodeSize = isSpecial ? 5 : 7;

          return (
            <div key={slot} className="flex items-start">
              {idx > 0 && <div style={{ width: LINE_W }} />}
              <div className="flex justify-center" style={{ width: nodeSize }}>
                <span
                  className="leading-none select-none whitespace-nowrap"
                  style={{
                    fontSize: isSpecial ? 8 : 9,
                    fontFamily: 'var(--font-serif)',
                    letterSpacing: '0.02em',
                    color: isCurrent
                      ? 'oklch(0.45 0.08 55)'
                      : isPast
                        ? 'oklch(0.65 0.02 90 / 60%)'
                        : 'oklch(0.70 0.02 90 / 35%)',
                  }}
                >
                  {labels[slot]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
