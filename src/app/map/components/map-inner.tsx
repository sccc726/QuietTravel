'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Destination } from '@/lib/destinations';

interface MapInnerProps {
  destinations: Destination[];
  selectedId: string | null;
  onDestinationClick: (dest: Destination) => void;
}

/** 中国中心视角，展示大部分国土 */
const INITIAL_CENTER: L.LatLngExpression = [34.5, 108];
const INITIAL_ZOOM = 5;

export default function MapInner({
  destinations,
  selectedId,
  onDestinationClick,
}: MapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 创建自定义橙色光点图标 */
  const createMarkerIcon = (isSelected: boolean) => {
    const selectedRing = isSelected
      ? '<div style="position:absolute;inset:-4px;border-radius:50%;border:1.5px solid oklch(0.72 0.17 55 / 50%);"></div>'
      : '';
    return L.divIcon({
      className: '',
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
  };

  /** 同步标记到地图 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(destinations.map(d => d.id));

    // 移除已不存在的标记
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    // 添加或更新标记
    for (const dest of destinations) {
      const existing = markersRef.current.get(dest.id);
      const isSelected = selectedId === dest.id;

      if (existing) {
        // 更新图标（选中态）
        existing.setIcon(createMarkerIcon(isSelected));
      } else {
        // 新增标记
        const marker = L.marker([dest.coordinates.lat, dest.coordinates.lng], {
          icon: createMarkerIcon(false),
        })
          .addTo(map)
          .on('click', () => {
            onDestinationClick(dest);
          });

        // 名称 tooltip
        marker.bindTooltip(dest.name, {
          direction: 'top',
          offset: [0, -18],
          className: 'destination-tooltip',
          permanent: false,
        });

        markersRef.current.set(dest.id, marker);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations, selectedId, onDestinationClick]);

  /** 选中目的地时平移到该位置 */
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
