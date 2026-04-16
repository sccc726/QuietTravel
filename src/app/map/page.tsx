'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { destinations, type Destination, type Spot } from '@/lib/destinations';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

/** 橙色光点脉冲动画样式 */
const markerStyles = `
@keyframes orangePulse {
  0% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(1); opacity: 0.7; }
}
@keyframes orangeCore {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}
.destination-marker {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.destination-marker .pulse {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: oklch(0.72 0.17 55 / 25%);
  animation: orangePulse 2.5s ease-out infinite;
}
.destination-marker .core {
  position: relative;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: oklch(0.72 0.17 55);
  box-shadow: 0 0 8px oklch(0.72 0.17 55 / 50%);
  animation: orangeCore 2.5s ease-in-out infinite;
  z-index: 1;
}
.destination-marker .label {
  position: absolute;
  top: -24px;
  white-space: nowrap;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 13px;
  font-weight: 300;
  letter-spacing: 2px;
  color: oklch(0.35 0.04 55);
  text-shadow: 0 0 4px oklch(1 0 0 / 80%), 0 0 8px oklch(1 0 0 / 40%);
  pointer-events: none;
}

/* Leaflet 容器样式覆盖 — 匹配文艺留白风格 */
.leaflet-container {
  background: oklch(0.96 0.003 100) !important;
  font-family: 'LXGW WenKai', sans-serif !important;
}
.leaflet-control-zoom {
  border: none !important;
  box-shadow: 0 1px 4px oklch(0 0 0 / 6%) !important;
  border-radius: 8px !important;
  overflow: hidden;
}
.leaflet-control-zoom a {
  background: oklch(0.99 0.002 100) !important;
  color: oklch(0.4 0.02 80) !important;
  border: none !important;
  border-bottom: 1px solid oklch(0.92 0.005 100) !important;
  width: 32px !important;
  height: 32px !important;
  line-height: 32px !important;
  font-size: 16px !important;
}
.leaflet-control-zoom a:last-child {
  border-bottom: none !important;
}
.leaflet-control-zoom a:hover {
  background: oklch(0.96 0.003 100) !important;
}
.leaflet-control-attribution {
  background: oklch(0.98 0.002 100 / 80%) !important;
  color: oklch(0.6 0.01 80) !important;
  font-size: 10px !important;
  padding: 2px 6px !important;
}
.leaflet-control-attribution a {
  color: oklch(0.5 0.03 160) !important;
}
`;

/** 动态加载 MapInner，禁用 SSR（Leaflet 依赖 window/DOM） */
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <style>{markerStyles}</style>

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

        {/* 景点面板 */}
        {selected && (
          <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/40 z-10 animate-fade-in-up">
            <div className="max-w-lg mx-auto px-6 py-5">
              <div className="flex items-center gap-2 mb-2">
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
