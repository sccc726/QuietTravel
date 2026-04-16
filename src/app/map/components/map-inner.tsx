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
  onDestinationClick: (dest: Destination) => void;
}

/** 中国中心视角 */
const INITIAL_CENTER: L.LatLngExpression = [34.5, 108];
const INITIAL_ZOOM = 5;

/** 创建橙色脉冲光点图标 */
function createMarkerIcon(isSelected: boolean): L.DivIcon {
  const selectedRing = isSelected
    ? '<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid oklch(0.72 0.17 55 / 45%);"></div>'
    : '';
  return L.divIcon({
    className: 'destination-marker-wrapper',
    html: `
      <div class="destination-marker">
        <div class="pulse"></div>
        <div class="core"></div>
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

    // 高德瓦片图层 — 无需 API Key
    L.tileLayer(
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      {
        subdomains: ['1', '2', '3', '4'],
        maxZoom: 18,
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
        const marker = L.marker([dest.coordinates.lat, dest.coordinates.lng], {
          icon: createMarkerIcon(false),
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
  }, [destinations]);

  // 选中态更新 — 只切换图标
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      marker.setIcon(createMarkerIcon(id === selectedId));
    }
  }, [selectedId]);

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
