'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { destinations, type Destination, type Spot } from '@/lib/destinations';
import { ArrowLeft, MapPin } from 'lucide-react';

/** 橙色光点脉冲动画 */
const pulseStyles = `
@keyframes orangePulse {
  0% { r: 5; opacity: 0.8; }
  50% { r: 9; opacity: 0.3; }
  100% { r: 5; opacity: 0.8; }
}
@keyframes orangeCore {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
`;

export default function MapPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Destination | null>(null);

  const handleDestinationClick = (dest: Destination) => {
    setSelected(prev => (prev?.id === dest.id ? null : dest));
  };

  const handleSpotClick = (_spot: Spot) => {
    // 后续扩展：进入景点详情/经营页面
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 animate-fade-in-up">
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
      <div className="flex-1 relative overflow-hidden">
        <style>{pulseStyles}</style>

        {/* SVG 地图 */}
        <svg
          viewBox="0 0 100 80"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 背景纹理 - 极淡的网格 */}
          <defs>
            <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
              <path
                d="M 5 0 L 0 0 0 5"
                fill="none"
                stroke="oklch(0.88 0.005 100)"
                strokeWidth="0.08"
              />
            </pattern>
            {/* 橙色光点渐变 */}
            <radialGradient id="orangeGlow">
              <stop offset="0%" stopColor="oklch(0.72 0.17 55)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="oklch(0.72 0.17 55)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="100" height="80" fill="url(#grid)" />

          {/* 简化的中国轮廓 — 柔和的线条 */}
          <path
            d="M 28 8 L 34 6 L 42 5 L 50 7 L 56 5 L 62 6 L 68 4 L 74 6 L 80 10 L 82 14 L 80 18 L 78 22 L 80 26 L 82 30 L 80 34 L 76 38 L 78 42 L 76 46 L 72 48 L 68 52 L 64 54 L 60 56 L 56 58 L 52 60 L 48 62 L 44 60 L 40 58 L 36 56 L 32 54 L 28 52 L 24 50 L 20 48 L 18 44 L 16 40 L 14 36 L 16 32 L 18 28 L 16 24 L 18 20 L 20 16 L 22 12 L 26 10 Z"
            fill="oklch(0.94 0.006 100)"
            stroke="oklch(0.82 0.01 100)"
            strokeWidth="0.3"
            strokeLinejoin="round"
          />

          {/* 长江 — 柔和的曲线 */}
          <path
            d="M 22 40 C 28 38, 34 42, 40 40 C 46 38, 52 44, 58 42 C 64 40, 68 44, 74 46"
            fill="none"
            stroke="oklch(0.82 0.015 220)"
            strokeWidth="0.4"
            strokeLinecap="round"
            strokeDasharray="1.5 1"
          />

          {/* 目的地标记 */}
          {destinations.map(dest => {
            const isSelected = selected?.id === dest.id;
            return (
              <g
                key={dest.id}
                className="cursor-pointer"
                onClick={() => handleDestinationClick(dest)}
              >
                {/* 外圈脉冲 */}
                <circle
                  cx={dest.position.x}
                  cy={dest.position.y}
                  r="5"
                  fill="url(#orangeGlow)"
                  style={{
                    animation: 'orangePulse 2.5s ease-in-out infinite',
                    transformOrigin: `${dest.position.x}px ${dest.position.y}px`,
                  }}
                />
                {/* 内圈 */}
                <circle
                  cx={dest.position.x}
                  cy={dest.position.y}
                  r="2"
                  fill="oklch(0.72 0.17 55)"
                  style={{
                    animation: 'orangeCore 2.5s ease-in-out infinite',
                  }}
                />
                {/* 选中时的外环 */}
                {isSelected && (
                  <circle
                    cx={dest.position.x}
                    cy={dest.position.y}
                    r="4"
                    fill="none"
                    stroke="oklch(0.72 0.17 55)"
                    strokeWidth="0.3"
                    opacity="0.5"
                  />
                )}
                {/* 名称标注 */}
                <text
                  x={dest.position.x}
                  y={dest.position.y - 4.5}
                  textAnchor="middle"
                  fill="oklch(0.35 0.04 55)"
                  fontSize="2.8"
                  fontFamily="'Noto Serif SC', 'Songti SC', serif"
                  fontWeight="300"
                  letterSpacing="0.5"
                >
                  {dest.name}
                </text>
              </g>
            );
          })}

          {/* 右下角图例 */}
          <g transform="translate(86, 72)">
            <circle cx="0" cy="0" r="1.2" fill="oklch(0.72 0.17 55)" />
            <text
              x="2.5"
              y="0.6"
              fill="oklch(0.6 0.02 80)"
              fontSize="2"
              fontFamily="'LXGW WenKai', sans-serif"
            >
              可达
            </text>
          </g>
        </svg>

        {/* 景点面板 */}
        {selected && (
          <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 animate-fade-in-up">
            <div className="max-w-lg mx-auto px-6 py-5">
              {/* 目的地标题 */}
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-orange-400/80" />
                <h2
                  className="text-lg font-light tracking-wider text-foreground/85"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {selected.name}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground/60 mb-4 leading-relaxed pl-6">
                {selected.description}
              </p>

              {/* 景点列表 */}
              <div className="space-y-2 pl-6">
                <p
                  className="text-[11px] text-muted-foreground/40 tracking-widest mb-2"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  可选景点
                </p>
                {selected.spots.map(spot => (
                  <button
                    key={spot.id}
                    onClick={() => handleSpotClick(spot)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-border/50 bg-card/60 hover:bg-accent/40 hover:border-accent-green/20 transition-all duration-300 group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm text-foreground/80 group-hover:text-accent-green transition-colors duration-300"
                            style={{ fontFamily: 'var(--font-serif)' }}
                          >
                            {spot.name}
                          </span>
                          {spot.tag && (
                            <span className="text-[10px] text-muted-foreground/40 border border-border/60 rounded px-1.5 py-0.5">
                              {spot.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                          {spot.description}
                        </p>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground/25 group-hover:text-accent-green/60 transition-colors duration-300 shrink-0 ml-3"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>

              {/* 关闭按钮 */}
              <div className="flex justify-center mt-4">
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
