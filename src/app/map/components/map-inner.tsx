'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Destination } from '@/lib/destinations';

// 修复 Leaflet 默认图标在 webpack 中的路径问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '',
  iconUrl: '',
  shadowUrl: '',
});

interface MapInnerProps {
  destinations: Destination[];
  selectedId: string | null;
  visitedMap: Record<string, { visitedPlaceIds: string[]; totalPlaces: number }>;
  onDestinationClick: (dest: Destination) => void;
}

/** 目的地标记类型 */
type MarkerState = 'unvisited' | 'visited' | 'completed';

function getMarkerState(dest: Destination, visitedMap: Record<string, { visitedPlaceIds: string[]; totalPlaces: number }>): MarkerState {
  const entry = visitedMap[dest.id];
  if (!entry || entry.visitedPlaceIds.length === 0) return 'unvisited';
  if (entry.totalPlaces > 0 && entry.visitedPlaceIds.length >= entry.totalPlaces) return 'completed';
  return 'visited';
}

/** 中国中心视角 */
const INITIAL_CENTER: L.LatLngExpression = [34.5, 108];
const INITIAL_ZOOM = 4;

/** 创建目的地光点图标 */
function createMarkerIcon(state: MarkerState, isSelected: boolean): L.DivIcon {
  // 颜色映射
  const colors: Record<MarkerState, { core: string; pulse: string; ring: string }> = {
    unvisited: { core: 'oklch(0.72 0.17 55)', pulse: 'oklch(0.72 0.17 55 / 40%)', ring: 'oklch(0.72 0.17 55 / 45%)' },   // 橙色
    visited:   { core: 'oklch(0.75 0.12 160)', pulse: 'oklch(0.75 0.12 160 / 40%)', ring: 'oklch(0.75 0.12 160 / 45%)' }, // 浅绿色
    completed: { core: 'oklch(0.65 0.02 90)', pulse: 'oklch(0.65 0.02 90 / 30%)', ring: 'oklch(0.65 0.02 90 / 35%)' },   // 灰色
  };
  const c = colors[state];
  const selectedRing = isSelected
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${c.ring};"></div>`
    : '';
  const noPulse = state === 'completed' ? 'animation:none;' : '';
  return L.divIcon({
    className: 'destination-marker-wrapper',
    html: `
      <div class="destination-marker">
        <div class="pulse" style="background:${c.pulse};${noPulse}"></div>
        <div class="core" style="background:${c.core}"></div>
        ${selectedRing}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export default function MapInner({
  destinations,
  selectedId,
  visitedMap,
  onDestinationClick,
}: MapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  // 用 ref 存储最新的回调，避免 useEffect 依赖不稳定回调
  const onClickRef = useRef(onDestinationClick);
  useEffect(() => {
    onClickRef.current = onDestinationClick;
  }, [onDestinationClick]);

  // 初始化地图（只执行一次）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    // 高德瓦片图层 — 无需 API Key（detectRetina 自动适配高分屏）
    L.tileLayer(
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      {
        subdomains: ['1', '2', '3', '4'],
        maxZoom: 18,
        detectRetina: true,
        attribution: '&copy; 高德地图',
      }
    ).addTo(map);

    // 确保容器尺寸正确
    map.invalidateSize();

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // 动态同步标记：根据 destinations 数组增删 marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(markersRef.current.keys());
    const newIds = new Set(destinations.map(d => d.id));

    // 移除不再存在的标记
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        const marker = markersRef.current.get(id);
        if (marker) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }
    }

    // 添加新标记
    for (const dest of destinations) {
      if (!currentIds.has(dest.id)) {
        const state = getMarkerState(dest, visitedMap);
        const marker = L.marker([dest.coordinates.lat, dest.coordinates.lng], {
          icon: createMarkerIcon(state, false),
        })
          .addTo(map)
          .on('click', () => {
            onClickRef.current(dest);
          });

        marker.bindTooltip(dest.name, {
          direction: 'top',
          offset: [0, -18],
          className: 'destination-tooltip',
          permanent: false,
        });

        markersRef.current.set(dest.id, marker);
      }
    }
  }, [destinations, visitedMap]);

  // 选中态/访问态更新 — 重新设置图标
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const dest = destinations.find(d => d.id === id);
      const state = dest ? getMarkerState(dest, visitedMap) : 'unvisited';
      marker.setIcon(createMarkerIcon(state, id === selectedId));
    }
  }, [selectedId, visitedMap, destinations]);

  // 选中目的地时飞到该位置
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;

    const dest = destinations.find(d => d.id === selectedId);
    if (dest) {
      map.flyTo([dest.coordinates.lat, dest.coordinates.lng], 10, {
        duration: 1.2,
      });
    }
  }, [selectedId, destinations]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
