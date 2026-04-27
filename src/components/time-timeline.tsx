'use client';

import { TimeSlot, timeSlotName, timeSlotShortName, isSpecialSlot, ALL_TIME_SLOTS } from '@/lib/destinations';

interface TimeTimelineProps {
  day: number;
  timeSlot: TimeSlot;
  /** 是否显示完整名称（默认显示简称） */
  fullNames?: boolean;
  /** 紧凑模式，不显示天数文字 */
  compact?: boolean;
}

/** 时间线组件 — 9 个节点，当前时段有棕色光点 */
export default function TimeTimeline({ day, timeSlot, fullNames = false, compact = false }: TimeTimelineProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {!compact && (
        <div className="text-[10px] text-muted-foreground/50 tracking-widest" style={{ fontFamily: 'var(--font-serif)' }}>
          第{day}天 · {timeSlotName(timeSlot)}
        </div>
      )}
      <div className="flex items-center gap-0">
        {ALL_TIME_SLOTS.map((slot, idx) => {
          const isCurrent = slot === timeSlot;
          const isPast = slot < timeSlot || (isSpecialSlot(timeSlot) && slot < timeSlot);
          const isSpecial = isSpecialSlot(slot);
          const isDawn = slot === TimeSlot.dawn;
          const isLatenight = slot === TimeSlot.latenight;

          // 节点尺寸
          const nodeSize = isSpecial ? 6 : 8;
          // 当前时段的光点尺寸
          const glowSize = isSpecial ? 14 : 18;

          return (
            <div key={slot} className="flex items-center">
              {/* 连线 — 第一个节点前不画线 */}
              {idx > 0 && (
                <div
                  className="h-px bg-muted-foreground/15"
                  style={{ width: isSpecial ? 8 : 12 }}
                />
              )}
              {/* 节点 */}
              <div className="relative flex flex-col items-center">
                {/* 光点（仅当前时段） */}
                {isCurrent && (
                  <div
                    className="absolute rounded-full animate-pulse"
                    style={{
                      width: glowSize,
                      height: glowSize,
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'oklch(0.55 0.10 60 / 25%)',
                    }}
                  />
                )}
                <div
                  className="relative rounded-full transition-all duration-300"
                  style={{
                    width: nodeSize,
                    height: nodeSize,
                    // 当前时段：棕色实心 + 光晕
                    // 已过时段：实心灰色
                    // 未到时段：空心描边
                    background: isCurrent
                      ? 'oklch(0.45 0.08 55)'
                      : isPast
                        ? 'oklch(0.65 0.02 90)'
                        : 'transparent',
                    border: isCurrent
                      ? 'none'
                      : isPast
                        ? 'none'
                        : `${isSpecial ? 1 : 1}px solid oklch(0.70 0.02 90 / 50%)`,
                    boxShadow: isCurrent
                      ? '0 0 6px oklch(0.45 0.08 55 / 50%)'
                      : 'none',
                  }}
                />
                {/* 标签 — 仅常规时段显示，额外时段也显示 */}
                <span
                  className="mt-0.5 leading-none select-none"
                  style={{
                    fontSize: isSpecial ? 8 : 9,
                    fontFamily: 'var(--font-serif)',
                    color: isCurrent
                      ? 'oklch(0.45 0.08 55)'
                      : isPast
                        ? 'oklch(0.65 0.02 90 / 60%)'
                        : 'oklch(0.70 0.02 90 / 35%)',
                  }}
                >
                  {fullNames ? timeSlotName(slot) : timeSlotShortName(slot)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
