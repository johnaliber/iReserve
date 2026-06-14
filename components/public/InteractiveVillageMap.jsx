'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import PropertyDetailModal from './PropertyDetailModal';
import AmenityTooltip from '@/components/map/AmenityTooltip';
import { 
  Layers, 
  SlidersHorizontal, 
  Coins, 
  Compass, 
  ShieldAlert, 
  Sun, 
  Search,
  Sparkles,
  Play,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import DelayedLoadingState from '@/components/shared/DelayedLoadingState';
import { useRealtimeBlueprint } from '@/lib/realtime/useRealtimeBlueprint';
import { useRealtimeProperties } from '@/lib/realtime/useRealtimeVillage';
import { useRealtimeRefresh } from '@/lib/realtime/useRealtimeRefresh';

// Synchronous react-konva imports, component is loaded dynamically by parent pages to avoid SSR issues
import { Stage, Layer, Line, Circle, Rect, Text, Group, Shape, Ellipse, Image as KonvaImage } from 'react-konva';
import { getAmenityDefaults, isAmenityObject } from '@/lib/blueprints/amenities';

const DEFAULT_CANVAS = { width: 3000, height: 2200 };

function getPointsBounds(points = []) {
  if (!points.length) return null;
  const xs = points.filter((_, idx) => idx % 2 === 0);
  const ys = points.filter((_, idx) => idx % 2 === 1);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}

function getObjectBounds(object) {
  const data = object.object_data || {};

  if (Array.isArray(data.points) && data.points.length >= 2) {
    return getPointsBounds(data.points);
  }

  if (typeof data.x === 'number' || typeof data.y === 'number') {
    const x = data.x || 0;
    const y = data.y || 0;
    const radius = data.radius || 0;
    return {
      minX: x - radius,
      minY: y - radius,
      maxX: x + (data.width || radius),
      maxY: y + (data.height || radius)
    };
  }

  return null;
}

function getObjectsBounds(objects = [], canvas = DEFAULT_CANVAS) {
  const bounds = objects
    .filter((object) => object.is_visible !== false)
    .map(getObjectBounds)
    .filter(Boolean);

  if (bounds.length === 0) {
    return { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height };
  }

  return bounds.reduce((acc, bound) => ({
    minX: Math.min(acc.minX, bound.minX),
    minY: Math.min(acc.minY, bound.minY),
    maxX: Math.max(acc.maxX, bound.maxX),
    maxY: Math.max(acc.maxY, bound.maxY)
  }));
}

function getFitTransform(bounds, viewport, padding = 24) {
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);

  return {
    scale,
    x: (viewport.width - contentWidth * scale) / 2 - bounds.minX * scale,
    y: (viewport.height - contentHeight * scale) / 2 - bounds.minY * scale
  };
}

function buildCurveControls(points = []) {
  const controls = [];
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[i + 2];
    const y2 = points[i + 3];
    controls.push({
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2
    });
  }
  return controls;
}

function drawCurvePath(context, points = [], controls = []) {
  if (points.length < 4) return;

  context.beginPath();
  context.moveTo(points[0], points[1]);

  for (let segment = 0; segment < (points.length / 2) - 1; segment += 1) {
    const endX = points[(segment + 1) * 2];
    const endY = points[(segment + 1) * 2 + 1];
    const control = controls[segment] || {
      x: (points[segment * 2] + endX) / 2,
      y: (points[segment * 2 + 1] + endY) / 2
    };

    context.quadraticCurveTo(control.x, control.y, endX, endY);
  }
}

function PublicImageLayer({ object, adminPropertyMode = false }) {
  const [image, setImage] = useState(null);
  const data = object.object_data || {};
  const imageUrl = data.image_url || data.imageUrl;

  useEffect(() => {
    if (!imageUrl) return undefined;
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = imageUrl;
    return undefined;
  }, [imageUrl]);

  const isVisibleForMode = adminPropertyMode
    ? data.showInAdminPreview !== false
    : data.showInPublicMap !== false;

  if (!image || object.is_visible === false || !isVisibleForMode) return null;

  return (
    <KonvaImage
      image={image}
      x={data.x || 0}
      y={data.y || 0}
      width={data.width || 600}
      height={data.height || 400}
      rotation={data.rotation || 0}
      opacity={data.opacity ?? 0.6}
      listening={false}
    />
  );
}


export default function InteractiveVillageMap({
  villageSlug,
  onPropertySelect,
  hideSidebar = false,
  allowDemoFallback = true,
  adminPropertyMode = false,
  adminShowHidden = false,
  preferDraftBlueprint = false,
  showSmartAssistant = true,
  onAdminObjectSelect
}) {
  const supabase = createClient();
  const stageRef = useRef(null);
  const viewportRef = useRef(null);
  const hoverCardRef = useRef(null);
  const hoverFrameRef = useRef(null);

  // States
  const [loading, setLoading] = useState(true);
  const [village, setVillage] = useState(null);
  const [objects, setObjects] = useState([]);
  const [blueprintCanvas, setBlueprintCanvas] = useState(DEFAULT_CANVAS);
  const [properties, setProperties] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 600 });
  const [hoverPreview, setHoverPreview] = useState(null);

  // Overlays
  const [layers, setLayers] = useState({
    reference: true,
    roads: true,
    lots: true,
    amenities: true,
    flood: true,
    sunlight: true
  });

  // Modal / Detail state
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState(10000000);
  const [minRooms, setMinRooms] = useState(0);
  const [floodRiskFilter, setFloodRiskFilter] = useState('');

  // Recommendation Engine State
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recBudget, setRecBudget] = useState(5000000);
  const [recRooms, setRecRooms] = useState(3);
  const [recParking, setRecParking] = useState(1);
  const [recFloodPreference, setRecFloodPreference] = useState('low'); // prefer low risk
  const [recSunlightPreference, setRecSunlightPreference] = useState('morning');
  const [recommendations, setRecommendations] = useState([]);

  const panelClass = adminPropertyMode
    ? 'rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm'
    : 'bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg glass-card';
  const panelTitleClass = adminPropertyMode
    ? 'text-xs font-extrabold text-[#272727] uppercase tracking-wider mb-4 border-b border-[#e2e8f0] pb-3'
    : 'text-xs font-bold text-slate-350 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2';
  const filterControlClass = adminPropertyMode
    ? 'w-full rounded-lg border border-[#dbe4ee] bg-white p-2.5 text-sm text-[#272727] shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15'
    : 'w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 outline-none text-slate-350 cursor-pointer';
  const labelClass = adminPropertyMode
    ? 'block text-[10px] text-[#64748b] uppercase tracking-wider mb-1.5 font-bold'
    : 'block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5';

  const fetchMapData = useCallback(async ({
    showLoading = true,
    reconcile = true,
    clearOnError = true
  } = {}) => {
    if (showLoading) setLoading(true);
    try {
      if (reconcile) {
        const reconcileResponse = await fetch(
          `/api/maps/reconcile?villageSlug=${encodeURIComponent(villageSlug)}`,
          { cache: 'no-store' }
        );
        if (!reconcileResponse.ok) {
          const reconcilePayload = await reconcileResponse.json().catch(() => ({}));
          console.warn('Map property reconciliation skipped:', reconcilePayload.error || reconcileResponse.statusText);
        }
      }

      // 1. Fetch village
      const { data: v, error: vError } = await supabase
        .from('villages')
        .select('*')
        .eq('slug', villageSlug)
        .single();

      if (vError || !v) {
        if (!allowDemoFallback) {
          if (clearOnError) {
            setVillage(null);
            setProperties([]);
            setObjects([]);
          }
          return;
        }

        console.warn('Village not found in database, loading mock data templates for preview.');
        setVillage({
          id: 'mock-1',
          name: villageSlug === 'teal-lagoon' ? 'Teal Lagoon Residences' : 'Emerald Ridge Heights',
          slug: villageSlug,
          city: 'Tagaytay',
          province: 'Cavite'
        });
        setObjects(getMockObjects('mock-1'));
        return;
      }
      
      setVillage(v);

      // 2. Fetch blueprint
      let blueprintQuery = supabase
        .from('blueprints')
        .select('id, canvas_width, canvas_height')
        .eq('village_id', v.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      blueprintQuery = preferDraftBlueprint
        ? blueprintQuery.in('status', ['draft', 'published'])
        : blueprintQuery.eq('status', 'published');

      const { data: bp } = await blueprintQuery.maybeSingle();
      if (bp) {
        setBlueprintCanvas({
          width: bp.canvas_width || DEFAULT_CANVAS.width,
          height: bp.canvas_height || DEFAULT_CANVAS.height
        });
      }

      // 3. Fetch properties
      const { data: props } = await supabase
        .from('properties')
        .select('*')
        .eq('village_id', v.id);

      const loadedProps = (props || []).filter((prop) => adminShowHidden || prop.status !== 'hidden');
      setProperties(loadedProps);

      if (bp) {
        // 4. Fetch blueprint objects
        const { data: objs } = await supabase
          .from('blueprint_objects')
          .select('*')
          .eq('blueprint_id', bp.id);

        setObjects(objs || []);
      } else {
        setObjects(allowDemoFallback ? getMockObjects(v.id) : []);
      }

    } catch (err) {
      console.error('Error loading interactive map data:', err);
      if (!allowDemoFallback) {
        if (clearOnError) {
          setVillage(null);
          setProperties([]);
          setObjects([]);
        }
        return;
      }

      // Robust recovery fallback state
      setVillage({
        id: 'mock-1',
        name: 'Emerald Ridge Heights',
        slug: villageSlug,
        city: 'Tagaytay',
        province: 'Cavite'
      });
      setObjects(getMockObjects('mock-1'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [villageSlug, supabase, allowDemoFallback, adminShowHidden, preferDraftBlueprint]);
  const refreshMapSilently = useCallback(() => {
    fetchMapData({
      showLoading: false,
      reconcile: false,
      clearOnError: false
    });
  }, [fetchMapData]);
  const scheduleMapRefresh = useRealtimeRefresh(refreshMapSilently, 300);
  const handlePropertyRealtime = useCallback((payload) => {
    setProperties((current) => {
      if (payload.eventType === 'DELETE') {
        return current.filter((property) => property.id !== payload.old?.id);
      }

      const changed = payload.new;
      if (!changed?.id) return current;
      if (!adminShowHidden && changed.status === 'hidden') {
        return current.filter((property) => property.id !== changed.id);
      }

      const exists = current.some((property) => property.id === changed.id);
      return exists
        ? current.map((property) => property.id === changed.id ? { ...property, ...changed } : property)
        : [...current, changed];
    });
    setSelectedProperty((current) => (
      current?.id === payload.new?.id ? { ...current, ...payload.new } : current
    ));
  }, [adminShowHidden, setSelectedProperty]);
  const propertyRealtimeStatus = useRealtimeProperties({
    villageId: village?.id,
    onPropertyChange: handlePropertyRealtime
  });
  const blueprintRealtimeStatus = useRealtimeBlueprint({
    villageId: village?.id,
    onBlueprintChange: scheduleMapRefresh,
    onObjectChange: scheduleMapRefresh
  });

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setViewportSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(500, Math.round(rect.height))
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (villageSlug) {
      const timer = setTimeout(() => {
        fetchMapData();
      }, 0);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [villageSlug, fetchMapData]);

  useEffect(() => () => {
    if (hoverFrameRef.current) cancelAnimationFrame(hoverFrameRef.current);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setHoverPreview(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [villageSlug, preferDraftBlueprint, adminPropertyMode]);

  // Helper properties list if none are configured in database
  const getDisplayedProperties = () => {
    if (properties.length > 0) return properties;
    if (!allowDemoFallback) return [];

    return [
      { id: 'mock-prop-1', property_code: 'ERR-B1L1', block_number: '1', lot_number: '1', price: 4500000, reservation_fee: 5000, lot_size: 120, floor_area: 85, bedrooms: 3, bathrooms: 2, parking_slots: 1, orientation: 'East', flood_risk: 'low', sunlight_exposure: 'morning', status: 'available' },
      { id: 'mock-prop-2', property_code: 'ERR-B1L2', block_number: '1', lot_number: '2', price: 4200000, reservation_fee: 5000, lot_size: 110, floor_area: 75, bedrooms: 2, bathrooms: 1, parking_slots: 1, orientation: 'East', flood_risk: 'medium', sunlight_exposure: 'balanced', status: 'reserved' },
      { id: 'mock-prop-3', property_code: 'ERR-B1L3', block_number: '1', lot_number: '3', price: 4800000, reservation_fee: 5000, lot_size: 130, floor_area: 95, bedrooms: 3, bathrooms: 3, parking_slots: 2, orientation: 'West', flood_risk: 'low', sunlight_exposure: 'afternoon', status: 'sold' }
    ];
  };

  const displayedProps = getDisplayedProperties();
  const displayedPropsById = new Map(displayedProps.map((prop) => [prop.id, prop]));
  const displayedPropsByObjectId = new Map(
    displayedProps
      .filter((prop) => prop.blueprint_object_id)
      .map((prop) => [prop.blueprint_object_id, prop])
  );
  const getPropertyForObject = (object) => {
    if (!object) return null;
    return displayedPropsById.get(object.linked_property_id)
      || displayedPropsByObjectId.get(object.id)
      || null;
  };

  // Find dynamic property status color mapping
  const getLotFillColor = (lot, defaultFill) => {
    const prop = getPropertyForObject(lot);
    if (!prop) return adminPropertyMode ? '#cbd5e1' : (defaultFill || '#64748b');

    switch (prop.status) {
      case 'available': return '#10b981'; // Green
      case 'reserved': return '#f59e0b'; // Amber
      case 'sold': return '#ef4444'; // Red
      case 'under_maintenance': return '#64748b'; // Gray
      case 'hidden': return '#94a3b8';
      default: return '#3b82f6'; // Blue for Viewing
    }
  };

  const handleLotClick = (linkedPropId) => {
    if (!linkedPropId) return;
    if (onPropertySelect) {
      onPropertySelect(linkedPropId);
      return;
    }
    const prop = displayedProps.find(p => p.id === linkedPropId);
    if (prop) {
      setSelectedProperty(prop);
      setIsModalOpen(true);
    }
  };

  const handleBlueprintObjectClick = (object) => {
    const prop = getPropertyForObject(object);

    if (adminPropertyMode) {
      onAdminObjectSelect?.(object, prop);
      return;
    }

    if (prop?.id) {
      handleLotClick(prop.id);
    }
  };

  const setStageCursor = (cursor) => {
    const stage = stageRef.current;
    if (stage) {
      stage.container().style.cursor = cursor;
    }
  };

  const updateHoverPreviewPosition = () => {
    const stage = stageRef.current;
    const card = hoverCardRef.current;
    const viewport = viewportRef.current;
    if (!stage || !card || !viewport) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    if (hoverFrameRef.current) cancelAnimationFrame(hoverFrameRef.current);
    hoverFrameRef.current = requestAnimationFrame(() => {
      const cardRect = card.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const padding = 14;
      const x = Math.min(pointer.x + 18, Math.max(padding, viewportRect.width - cardRect.width - padding));
      const y = Math.min(pointer.y + 18, Math.max(padding, viewportRect.height - cardRect.height - padding));
      card.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  };

  const showHoverPreview = (object) => {
    setHoverPreview({
      object,
      property: getPropertyForObject(object)
    });
    requestAnimationFrame(updateHoverPreviewPosition);
  };

  const showAmenityPreview = (object) => {
    setHoverPreview({
      object,
      amenity: getAmenityDefaults(object),
      property: null
    });
    requestAnimationFrame(updateHoverPreviewPosition);
  };

  useEffect(() => {
    if (hoverPreview) requestAnimationFrame(updateHoverPreviewPosition);
  }, [hoverPreview]);

  // 1. FILTERING SYSTEM
  const filteredProps = displayedProps.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (p.price > maxPrice) return false;
    if (minRooms > 0 && p.bedrooms < minRooms) return false;
    if (floodRiskFilter && p.flood_risk !== floodRiskFilter) return false;
    return true;
  });
  const filteredPropertyIds = new Set(filteredProps.map((property) => property.id));
  const mappedPropertyIds = new Set(
    objects
      .filter((object) => object.object_type === 'lot' || object.object_type === 'house')
      .map((object) => getPropertyForObject(object)?.id)
      .filter(Boolean)
  );
  const mappedProperties = displayedProps.filter((property) => mappedPropertyIds.has(property.id));
  const unmappedPropertyCount = displayedProps.length - mappedProperties.length;
  const statusCounts = mappedProperties.reduce((counts, property) => {
    counts[property.status] = (counts[property.status] || 0) + 1;
    return counts;
  }, {});

  // 2. RULE-BASED PROPERTY RECOMMENDATION ENGINE
  const handleCalculateRecommendations = () => {
    const scores = displayedProps
      .filter(p => p.status === 'available')
      .map((p) => {
        let score = 100;

        // A. Match budget (subtract 30 points if over budget, otherwise score depends on proximity)
        if (p.price > recBudget) {
          score -= 35;
        } else {
          // Bonus score if it is within budget
          score += 10;
        }

        // B. Match rooms (within 1 room is fine, exact match gets bonus)
        if (p.bedrooms === recRooms) {
          score += 15;
        } else if (Math.abs(p.bedrooms - recRooms) === 1) {
          score += 5;
        } else {
          score -= 20;
        }

        // C. Match parking
        if (p.parking_slots >= recParking) {
          score += 10;
        } else {
          score -= 15;
        }

        // D. Match flood risk tolerance
        if (p.flood_risk === recFloodPreference) {
          score += 15;
        } else if (p.flood_risk === 'high' && recFloodPreference === 'low') {
          score -= 30; // severe penalty
        }

        // E. Match sunlight exposure
        if (p.sunlight_exposure === recSunlightPreference) {
          score += 10;
        }

        return {
          property: p,
          score: Math.max(0, Math.min(100, score))
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3 recommendations

    setRecommendations(scores);
  };

  const handleStageWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.05;
    setZoom((current) => Math.max(0.35, Math.min(3, e.evt.deltaY < 0 ? current * scaleBy : current / scaleBy)));
  };

  const contentBounds = useMemo(
    () => getObjectsBounds(objects, blueprintCanvas),
    [objects, blueprintCanvas]
  );
  const fitTransform = useMemo(
    () => getFitTransform(contentBounds, viewportSize, adminPropertyMode ? 18 : 24),
    [contentBounds, viewportSize, adminPropertyMode]
  );
  const stageTransform = {
    x: fitTransform.x + pan.x,
    y: fitTransform.y + pan.y,
    scale: fitTransform.scale * zoom
  };

  if (loading) {
    return <DelayedLoadingState loading message="Loading the interactive village map..." />;
  }

  if (!allowDemoFallback && !adminPropertyMode && objects.length === 0) {
    return (
      <div className="flex min-h-[500px] w-full items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
        <div className="max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <Layers className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#272727]">Map not available yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
            The interactive map for {village?.name || 'this village'} is still being prepared. Please check again later.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-500"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {!(propertyRealtimeStatus === 'connected' && blueprintRealtimeStatus === 'connected') && (
        <div className="mb-3 flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe4ee] bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
            <span className={`h-2 w-2 rounded-full ${
              propertyRealtimeStatus === 'error' || blueprintRealtimeStatus === 'error'
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`} />
            {propertyRealtimeStatus === 'error' || blueprintRealtimeStatus === 'error'
              ? 'Sync error'
              : 'Connecting'}
          </span>
        </div>
      )}
      {!adminPropertyMode && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Click a green lot to view details and start your reservation.
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch relative min-h-[calc(100vh-80px)] w-full">
      
      {/* 1. Left Column: Map legend, Filters, and Recommendations */}
      {!hideSidebar && (
        <div className="w-full lg:w-80 flex flex-col gap-6 flex-shrink-0">
        
        {/* Map Legend */}
        <div className={`${panelClass} select-none`}>
          <h4 className={panelTitleClass}>
            Status Legend
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-emerald-500 rounded-lg shadow-inner" />
              <span>Available ({statusCounts.available || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-amber-500 rounded-lg shadow-inner" />
              <span>Reserved ({statusCounts.reserved || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-red-500 rounded-lg shadow-inner" />
              <span>Sold ({statusCounts.sold || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-slate-500 rounded-lg shadow-inner" />
              <span>Maintenance ({statusCounts.under_maintenance || 0})</span>
            </div>
          </div>
          {unmappedPropertyCount > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-800">
              {unmappedPropertyCount} {unmappedPropertyCount === 1 ? 'property is' : 'properties are'} not linked to a map shape yet.
              {' The system will link available map shapes automatically when this map refreshes.'}
            </div>
          )}
        </div>

        {/* Dynamic Filters */}
        <div className={panelClass}>
          <div className={`flex items-center justify-between mb-4 border-b pb-3 ${adminPropertyMode ? 'border-[#e2e8f0]' : 'border-slate-800'}`}>
            <h4 className="text-xs font-extrabold text-[#272727] uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              Find a Lot
            </h4>
            {showSmartAssistant && showRecommendation && (
              <button 
                onClick={() => setShowRecommendation(false)}
                className="text-[10px] text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                Normal Filter
              </button>
            )}
          </div>

          {!showSmartAssistant || !showRecommendation ? (
            <div className="space-y-4 text-xs font-medium">
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={filterControlClass}
                >
                  <option value="">All lots</option>
                  <option value="available">Available (Green)</option>
                  <option value="reserved">Reserved (Yellow)</option>
                  <option value="sold">Sold (Red)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Max Budget</label>
                <select
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                  className={filterControlClass}
                >
                  <option value={10000000}>₱10,000,000 max</option>
                  <option value={6000000}>₱6,000,000 max</option>
                  <option value={4500000}>₱4,500,000 max</option>
                  <option value={3800000}>₱3,800,000 max</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Min Bedrooms</label>
                <input
                  type="number"
                  min="0"
                  value={minRooms}
                  onChange={(e) => setMinRooms(parseInt(e.target.value) || 0)}
                  className={filterControlClass}
                />
              </div>

              <div>
                <label className={labelClass}>Flood risk</label>
                <select
                  value={floodRiskFilter}
                  onChange={(e) => setFloodRiskFilter(e.target.value)}
                  className={filterControlClass}
                >
                  <option value="">Any Risk Level</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                </select>
              </div>

              {showSmartAssistant && (
                <button
                  onClick={() => setShowRecommendation(true)}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white py-2.5 rounded-xl text-xs font-semibold shadow transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Launch Smart Assistant
                </button>
              )}
            </div>
          ) : (
            /* AI / Rule-based Assistant Panel */
            <div className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Preferred Budget</label>
                <input
                  type="range"
                  min="3000000"
                  max="8000000"
                  step="500000"
                  value={recBudget}
                  onChange={(e) => setRecBudget(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer outline-none"
                />
                <span className="text-[10px] text-slate-400 block text-right mt-1">₱{recBudget.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Ideal BedRooms</label>
                <select
                  value={recRooms}
                  onChange={(e) => setRecRooms(parseInt(e.target.value))}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 outline-none text-slate-350 cursor-pointer"
                >
                  <option value={2}>2 Bedrooms</option>
                  <option value={3}>3 Bedrooms</option>
                  <option value={4}>4 Bedrooms</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Flood risk Tolerance</label>
                <select
                  value={recFloodPreference}
                  onChange={(e) => setRecFloodPreference(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-2 outline-none text-slate-350 cursor-pointer"
                >
                  <option value="low">Must be Low Risk (Recommended)</option>
                  <option value="medium">Medium is Acceptable</option>
                </select>
              </div>

              <button
                onClick={handleCalculateRecommendations}
                className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs shadow transition cursor-pointer"
              >
                Find Ideal Coordinates
              </button>

              {/* Recommendations list */}
              {recommendations.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Matching Lots:</span>
                  {recommendations.map(({ property, score }) => (
                    <div
                      key={property.id}
                      onClick={() => handleLotClick(property.id)}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900 hover:border-emerald-500/20 transition cursor-pointer flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-slate-200 block text-[11px]">
                          Block {property.block_number} Lot {property.lot_number}
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                        {score}% Match
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 2. Right Column: Konva stage viewport */}
      <div ref={viewportRef} className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative shadow-inner min-h-[500px]">
        {!adminPropertyMode && (
          <div className="absolute right-3 top-3 z-20 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setZoom((value) => Math.min(3, value * 1.2))} className="min-h-10 rounded-xl border border-[#dbe4ee] bg-white/95 px-3 text-xs font-extrabold shadow">Zoom In</button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.35, value / 1.2))} className="min-h-10 rounded-xl border border-[#dbe4ee] bg-white/95 px-3 text-xs font-extrabold shadow">Zoom Out</button>
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="min-h-10 rounded-xl border border-[#dbe4ee] bg-white/95 px-3 text-xs font-extrabold shadow">Reset View</button>
            <button type="button" onClick={() => setStatusFilter((value) => value === 'available' ? '' : 'available')} className={`min-h-10 rounded-xl border px-3 text-xs font-extrabold shadow ${statusFilter === 'available' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[#dbe4ee] bg-white/95'}`}>Available Only</button>
          </div>
        )}
        {/* Layer Visibility Overrides Controls inside the Stage */}
        <div className="absolute top-4 left-4 z-10 bg-slate-950/80 border border-slate-850 p-2 rounded-xl flex items-center gap-2 text-xs select-none glass-card font-medium">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-500 font-semibold mr-2 uppercase text-[9px] tracking-wider">Layers:</span>
          
          <button
            onClick={() => setLayers({ ...layers, flood: !layers.flood })}
            className={`px-2 py-1 rounded-lg border transition text-[10px] font-bold cursor-pointer ${layers.flood ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400'}`}
          >
            Flood Risk
          </button>
          
          <button
            onClick={() => setLayers({ ...layers, sunlight: !layers.sunlight })}
            className={`px-2 py-1 rounded-lg border transition text-[10px] font-bold cursor-pointer ${layers.sunlight ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400'}`}
          >
            Sunlight Exposure
          </button>
        </div>

        {/* Zoom details HUD */}
        <div className="absolute bottom-4 right-4 z-10 p-2 bg-slate-950/80 border border-slate-850 rounded-lg text-[9px] font-bold text-slate-500 select-none glass-card">
          SCROLL MOUSE WHEEL TO PAN & ZOOM • ACTIVE
        </div>

        <Stage
          width={viewportSize.width}
          height={viewportSize.height}
          x={stageTransform.x}
          y={stageTransform.y}
          scaleX={stageTransform.scale}
          scaleY={stageTransform.scale}
          ref={stageRef}
          onWheel={handleStageWheel}
          onDragEnd={(e) => {
            if (e.target !== stageRef.current) return;
            setPan({
              x: e.target.x() - fitTransform.x,
              y: e.target.y() - fitTransform.y
            });
          }}
          onDragStart={() => setHoverPreview(null)}
          draggable={true}
          className="cursor-grab active:cursor-grabbing"
        >
          {/* Layer 0: Published image layers */}
          <Layer>
            {layers.reference && objects
              .filter(o => o.object_type === 'image_layer' || (o.object_type === 'landmark' && o.object_data?.kind === 'reference_image'))
              .map((object) => (
                <PublicImageLayer
                  key={object.id}
                  object={object}
                  adminPropertyMode={adminPropertyMode}
                />
              ))}
          </Layer>

          {/* Layer 1: Roads border and asphalt */}
          <Layer>
            {/* Draw every road border first so intersections visually merge. */}
            {objects
              .filter(o => o.object_type === 'road' && o.is_visible !== false)
              .map((road) => {
                const data = road.object_data || {};
                const width = data.width || 30;
                const border = data.borderThickness || 5;
                const isPenCurve = data.curveMode === 'pen' || (data.curveControls || []).length > 0;

                if (isPenCurve) {
                  return (
                    <Shape
                      key={`road-border-${road.id}`}
                      sceneFunc={(context, shape) => {
                        drawCurvePath(context, data.points || [], data.curveControls || buildCurveControls(data.points || []));
                        context.strokeShape(shape);
                      }}
                      stroke={data.borderColor || '#334155'}
                      strokeWidth={width + border * 2}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                  );
                }

                return (
                  <Line
                    key={`road-border-${road.id}`}
                    points={data.points || []}
                    stroke={data.borderColor || '#334155'}
                    strokeWidth={width + border * 2}
                    lineCap="round"
                    lineJoin="round"
                    tension={data.tension || 0}
                    listening={false}
                  />
                );
              })}

            {/* Then draw every road fill on top, removing border seams at crossings. */}
            {objects
              .filter(o => o.object_type === 'road' && o.is_visible !== false)
              .map((road) => {
                const data = road.object_data || {};
                const isPenCurve = data.curveMode === 'pen' || (data.curveControls || []).length > 0;

                if (isPenCurve) {
                  return (
                    <Shape
                      key={`road-fill-${road.id}`}
                      sceneFunc={(context, shape) => {
                        drawCurvePath(context, data.points || [], data.curveControls || buildCurveControls(data.points || []));
                        context.strokeShape(shape);
                      }}
                      stroke={data.asphaltColor || '#cbd5e1'}
                      strokeWidth={data.width || 30}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                  );
                }

                return (
                  <Line
                    key={`road-fill-${road.id}`}
                    points={data.points || []}
                    stroke={data.asphaltColor || '#cbd5e1'}
                    strokeWidth={data.width || 30}
                    lineCap="round"
                    lineJoin="round"
                    tension={data.tension || 0}
                    listening={false}
                  />
                );
              })}
          </Layer>

          {/* Layer 2: Lot boundary polygons */}
          <Layer>
            {layers.lots && objects
              .filter(o => o.object_type === 'lot' || o.object_type === 'house')
              .filter((lot) => {
                const prop = getPropertyForObject(lot);
                if (!adminPropertyMode && prop?.status === 'hidden') return false;
                if (!prop) return adminPropertyMode && !statusFilter;
                return filteredPropertyIds.has(prop.id);
              })
              .map((lot) => {
                const data = lot.object_data || {};
                const isClickable = adminPropertyMode || !!getPropertyForObject(lot);
                
                // Fetch dynamic status color overrides
                const fill = getLotFillColor(lot, data.fillColor);
                
                return (
                  <Group
                    key={lot.id}
                    onClick={() => isClickable && handleBlueprintObjectClick(lot)}
                    onTap={() => isClickable && handleBlueprintObjectClick(lot)}
                    onMouseEnter={() => {
                      if (!isClickable) return;
                      setStageCursor('pointer');
                      showHoverPreview(lot);
                    }}
                    onMouseMove={() => {
                      if (isClickable) updateHoverPreviewPosition();
                    }}
                    onMouseLeave={() => {
                      setStageCursor('grab');
                      setHoverPreview(null);
                    }}
                  >
                    <Line
                      points={data.points || []}
                      fill={fill}
                      stroke={data.borderColor || '#047857'}
                      strokeWidth={1.5}
                      closed={true}
                      opacity={0.6}
                    />
                    {adminPropertyMode && data.points && data.points.length >= 4 && (
                      <Text
                        text={data.name || ''}
                        x={data.points[0]}
                        y={data.points[1] - 12}
                        fontSize={10}
                        fontStyle="bold"
                        fill="#272727"
                      />
                    )}
                  </Group>
                );
              })}
          </Layer>

          {/* Layer 3: Environmental risk overlays */}
          <Layer>
            {/* Flood Zone */}
            {layers.flood && objects
              .filter(o => o.object_type === 'zone')
              .map((zone) => {
                const data = zone.object_data || {};
                return (
                  <Line
                    key={zone.id}
                    points={data.points || []}
                    fill={data.color || '#f43f5e'}
                    closed={true}
                    opacity={data.opacity || 0.25}
                  />
                );
              })}

            {/* Public amenities, including legacy objects and custom shapes */}
            {layers.amenities && objects
              .filter((object) => isAmenityObject(object) && (object.is_visible !== false || adminShowHidden))
              .filter((object) => adminPropertyMode || getAmenityDefaults(object).showInPublicMap)
              .map((amenity) => {
                const data = amenity.object_data || {};
                const defaults = getAmenityDefaults(amenity);
                const interactive = defaults.showTooltip || adminPropertyMode;
                const eventProps = interactive ? {
                  listening: true,
                  onMouseEnter: () => {
                    setStageCursor('pointer');
                    if (defaults.showTooltip) showAmenityPreview(amenity);
                  },
                  onMouseMove: () => {
                    if (defaults.showTooltip) updateHoverPreviewPosition();
                  },
                  onMouseLeave: () => {
                    setStageCursor('grab');
                    setHoverPreview(null);
                  },
                  onClick: () => {
                    if (adminPropertyMode) {
                      onAdminObjectSelect?.(amenity, null);
                    } else if (defaults.showTooltip) {
                      showAmenityPreview(amenity);
                    }
                  },
                  onTap: () => {
                    if (adminPropertyMode) {
                      onAdminObjectSelect?.(amenity, null);
                    } else if (defaults.showTooltip) {
                      showAmenityPreview(amenity);
                    }
                  }
                } : { listening: false };
                let shape;

                if (defaults.shapeType === 'polygon' && data.points?.length >= 6) {
                  shape = (
                    <Line
                      points={data.points}
                      closed
                      lineJoin="round"
                      fill={defaults.fillColor}
                      stroke={defaults.borderColor}
                      strokeWidth={2}
                      opacity={defaults.opacity}
                      {...eventProps}
                    />
                  );
                } else if (defaults.shapeType === 'rectangle') {
                  shape = (
                    <Rect
                      x={data.x || 0}
                      y={data.y || 0}
                      width={data.width || 100}
                      height={data.height || 64}
                      rotation={data.rotation || 0}
                      fill={defaults.fillColor}
                      stroke={defaults.borderColor}
                      strokeWidth={1.5}
                      cornerRadius={5}
                      opacity={defaults.opacity}
                      {...eventProps}
                    />
                  );
                } else if (defaults.shapeType === 'ellipse') {
                  shape = (
                    <Ellipse
                      x={data.x || 0}
                      y={data.y || 0}
                      radiusX={(data.width || 90) / 2}
                      radiusY={(data.height || 56) / 2}
                      rotation={data.rotation || 0}
                      fill={defaults.fillColor}
                      stroke={defaults.borderColor}
                      strokeWidth={1.5}
                      opacity={defaults.opacity}
                      {...eventProps}
                    />
                  );
                } else {
                  shape = (
                    <Circle
                      x={data.x || 0}
                      y={data.y || 0}
                      radius={data.radius || Math.max(10, (data.width || 36) / 2)}
                      fill={defaults.fillColor}
                      stroke={defaults.borderColor}
                      strokeWidth={1.5}
                      opacity={defaults.opacity}
                      {...eventProps}
                    />
                  );
                }

                const labelX = data.points?.length >= 2 ? data.points[0] : (data.x || 0);
                const labelY = data.points?.length >= 2 ? data.points[1] - 16 : (data.y || 0) - 18;

                return (
                  <React.Fragment key={amenity.id}>
                    {shape}
                    {defaults.showLabel && (
                      <Text
                        x={labelX}
                        y={labelY}
                        text={defaults.name}
                        fontSize={11}
                        fontStyle="bold"
                        fill="#0f172a"
                        listening={false}
                      />
                    )}
                  </React.Fragment>
                );
              })}

            {/* Labels */}
            {objects
              .filter(o => o.object_type === 'label')
              .map((lbl) => {
                const data = lbl.object_data || {};
                return (
                  <Text
                    key={lbl.id}
                    x={data.x || 0}
                    y={data.y || 0}
                    text={data.text || ''}
                    width={data.width || 180}
                    fill={data.fill || '#272727'}
                    fontSize={data.fontSize || 12}
                    fontFamily={data.fontFamily || 'Inter'}
                    fontStyle={data.fontStyle || 'bold'}
                    align={data.align || 'left'}
                  />
                );
              })}
          </Layer>
        </Stage>
        {hoverPreview && (
          <div
            ref={hoverCardRef}
            className="pointer-events-none absolute left-0 top-0 z-20 w-[calc(100%-28px)] max-w-[330px] overflow-hidden rounded-2xl border border-[#dbe4ee] bg-white text-[#272727] shadow-[0_18px_45px_rgba(15,23,42,0.22)] will-change-transform"
            style={{ transform: 'translate3d(18px, 18px, 0)' }}
          >
            {hoverPreview.amenity ? (
              <AmenityTooltip amenity={hoverPreview.amenity} />
            ) : hoverPreview.property ? (
              <div className="p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-600">
                      {hoverPreview.property.property_type === 'lot' ? 'Residential Lot' : 'Home Preview'}
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold leading-tight text-[#171717]">
                      {adminPropertyMode
                        ? hoverPreview.property.property_code
                        : `Block ${hoverPreview.property.block_number}, Lot ${hoverPreview.property.lot_number}`}
                    </h3>
                    {adminPropertyMode && (
                      <p className="mt-1 text-xs font-medium text-[#64748b]">
                        Block {hoverPreview.property.block_number}, Lot {hoverPreview.property.lot_number}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${
                    hoverPreview.property.status === 'available'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : hoverPreview.property.status === 'reserved'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : hoverPreview.property.status === 'sold'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}>
                    {hoverPreview.property.status?.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="h-40 overflow-hidden rounded-xl bg-[#f1f5f9]">
                  <img
                    src={hoverPreview.property.thumbnail_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=500&q=80'}
                    alt="Property preview"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="mt-4">
                  <h4 className="text-base font-extrabold text-[#171717]">
                    {hoverPreview.property.model_name
                      || hoverPreview.property.property_type?.replaceAll('_', ' ')
                      || 'Lot / House'}
                  </h4>
                  <p className="mt-1 text-xs font-medium text-[#64748b]">
                    {village?.name || 'Village'}{hoverPreview.property.street_name ? ` - ${hoverPreview.property.street_name}` : ''}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#eef2f7] py-3 text-xs">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Price</p>
                    <p className="mt-1 font-extrabold text-[#171717]">
                      PHP {Number(hoverPreview.property.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Lot Area</p>
                    <p className="mt-1 font-extrabold text-[#171717]">
                      {hoverPreview.property.lot_size || 0} sqm
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Floor Area</p>
                    <p className="mt-1 font-extrabold text-[#171717]">
                      {hoverPreview.property.floor_area ? `${hoverPreview.property.floor_area} sqm` : 'Not applicable'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">Bedrooms</p>
                    <p className="mt-1 font-extrabold text-[#171717]">
                      {hoverPreview.property.bedrooms || 'Not applicable'}
                    </p>
                  </div>
                </div>

                <p className="pt-3 text-center text-xs font-extrabold text-emerald-700">
                  Click this lot to view full details
                </p>
              </div>
            ) : (
              <div className="p-5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                  {adminPropertyMode ? 'Needs Details' : 'Not Available'}
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-[#171717]">
                  No property details yet
                </h3>
                <p className="mt-2 text-xs leading-5 text-[#64748b]">
                  {adminPropertyMode
                    ? 'Click this object to create its property details.'
                    : 'This map object is not available for reservation.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Details Dialog Modal Popup */}
      <PropertyDetailModal
        property={selectedProperty}
        showInternalCode={adminPropertyMode}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProperty(null);
        }}
      />
      </div>
    </div>
  );
}

// Fallback visual blueprint dataset
const getMockObjects = (vId) => [
  {
    id: 'mock-road-1',
    object_type: 'road',
    layer_order: 1,
    is_visible: true,
    object_data: { name: 'Main Boulevard', points: [100, 250, 700, 250], width: 40, asphaltColor: '#e2e8f0', borderColor: '#334155', borderThickness: 6 }
  },
  {
    id: 'mock-road-2',
    object_type: 'road',
    layer_order: 1,
    is_visible: true,
    object_data: { name: 'Lake Side Alley', points: [350, 250, 350, 500], width: 25, asphaltColor: '#cbd5e1', borderColor: '#475569', borderThickness: 5 }
  },
  // Mock Lot Polygons
  {
    id: 'mock-lot-1',
    object_type: 'lot',
    layer_order: 2,
    is_visible: true,
    linked_property_id: 'mock-prop-1',
    object_data: { name: 'Block A Lot 1', points: [120, 100, 220, 100, 220, 200, 120, 200], fillColor: '#10b981', borderColor: '#047857' }
  },
  {
    id: 'mock-lot-2',
    object_type: 'lot',
    layer_order: 2,
    is_visible: true,
    linked_property_id: 'mock-prop-2',
    object_data: { name: 'Block A Lot 2', points: [240, 100, 340, 100, 340, 200, 240, 200], fillColor: '#f59e0b', borderColor: '#d97706' }
  },
  {
    id: 'mock-lot-3',
    object_type: 'lot',
    layer_order: 2,
    is_visible: true,
    linked_property_id: 'mock-prop-3',
    object_data: { name: 'Block A Lot 3', points: [360, 100, 460, 100, 460, 200, 360, 200], fillColor: '#ef4444', borderColor: '#b91c1c' }
  },
  // Mock Amenities
  {
    id: 'mock-tree-1',
    object_type: 'tree',
    layer_order: 3,
    is_visible: true,
    object_data: { x: 500, y: 150, radius: 12, fill: '#059669' }
  },
  {
    id: 'mock-clubhouse',
    object_type: 'clubhouse',
    layer_order: 3,
    is_visible: true,
    object_data: { x: 550, y: 320, width: 90, height: 60, fill: '#0ea5e9', name: 'Lagoon Clubhouse' }
  },
  // Flood Overlay
  {
    id: 'mock-flood-zone',
    object_type: 'zone',
    layer_order: 0,
    is_visible: true,
    object_data: { label: 'High Flood Risk Zone', color: '#f43f5e', opacity: 0.25, points: [500, 100, 800, 100, 800, 220, 500, 220] }
  }
];
