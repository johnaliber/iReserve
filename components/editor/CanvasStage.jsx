'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Group, Transformer } from 'react-konva';
import { getDistance } from '@/lib/editor/geometry';
import { findNearestSnapPoint, snapToGrid } from '@/lib/editor/snapUtils';

export default function CanvasStage({
  objects,
  setObjects,
  activeTool,
  setActiveTool,
  zoom,
  setZoom,
  gridEnabled,
  snapEnabled,
  previewMode,
  selectedObjectId,
  setSelectedObjectId,
  selectedObjectIds = [],
  setSelectedObjectIds,
  multiSelectEnabled = false,
  layersVisible,
  onSaveDraft
}) {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [tempPoint, setTempPoint] = useState(null);
  const [snapIndicator, setSnapIndicator] = useState(null);

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setTempPoint(null);
    setSnapIndicator(null);
  };

  const handleSelectObject = (id) => {
    if (activeTool !== 'select') return;
    
    if (multiSelectEnabled) {
      if (selectedObjectIds.includes(id)) {
        setSelectedObjectIds(selectedObjectIds.filter(x => x !== id));
      } else {
        setSelectedObjectIds([...selectedObjectIds, id]);
      }
    } else {
      setSelectedObjectIds([id]);
      setSelectedObjectId(id);
    }
  };

  // Track key press for escaping drawing state
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        cancelDrawing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingPoints]);

  // Get localized cursor coordinates relative to scale and pan positions
  const getRelativePointerPosition = () => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };

    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY()
    };
  };

  // Stage Pan and Zoom adjustments using mouse wheels
  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: (stage.getPointerPosition().x - stage.x()) / oldScale,
      y: (stage.getPointerPosition().y - stage.y()) / oldScale
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.2, Math.min(3, newScale));

    setZoom(clampedScale);
    stage.scale({ x: clampedScale, y: clampedScale });

    const newPos = {
      x: stage.getPointerPosition().x - mousePointTo.x * clampedScale,
      y: stage.getPointerPosition().y - mousePointTo.y * clampedScale
    };
    stage.position(newPos);
    setStagePos(newPos);
  };

  // Handle stage mouse press for drawing or panning
  const handleStageMouseDown = (e) => {
    // Click on empty space deselects elements
    if (e.target === stageRef.current) {
      setSelectedObjectId(null);
      setSelectedObjectIds([]);
      if (activeTool === 'select') return;
    }

    if (activeTool === 'pan' || e.evt.button === 1) {
      // Middle click or Pan tool allows panning by default dragging
      return;
    }

    const pos = getRelativePointerPosition();
    let clickedPoint = { x: pos.x, y: pos.y };

    // Apply snap if enabled
    if (snapEnabled) {
      const snap = findNearestSnapPoint(clickedPoint, objects, 15, gridEnabled, 20);
      if (snap) {
        clickedPoint = { x: snap.x, y: snap.y };
      }
    }

    // A. Handle Road Drawing
    if (activeTool === 'road_straight' || activeTool === 'road_curved') {
      const newPoints = [...drawingPoints, clickedPoint.x, clickedPoint.y];
      setDrawingPoints(newPoints);
    } 
    // B. Handle Lot Boundary Drawing
    else if (activeTool === 'lot_polygon') {
      // Check if clicking near starting vertex to close the polygon
      if (drawingPoints.length >= 6) {
        const startX = drawingPoints[0];
        const startY = drawingPoints[1];
        const dist = Math.sqrt((clickedPoint.x - startX) ** 2 + (clickedPoint.y - startY) ** 2);
        
        if (dist < 15) {
          // Close polygon shape!
          const newLot = {
            id: `lot-${Date.now()}`,
            village_id: null, // Will map in editor
            blueprint_id: null,
            object_type: 'lot',
            object_data: {
              name: `Block ${Math.floor(Math.random() * 5) + 1} Lot ${Math.floor(Math.random() * 15) + 1}`,
              points: [...drawingPoints],
              fillColor: '#10b981', // default available green
              borderColor: '#047857'
            },
            layer_order: 2,
            is_visible: true,
            is_locked: false
          };
          setObjects([...objects, newLot]);
          cancelDrawing();
          // Keep active tool for consecutive placements
          return;
        }
      }
      setDrawingPoints([...drawingPoints, clickedPoint.x, clickedPoint.y]);
    }
    // C. Click-To-Place standard elements
    else if (activeTool.startsWith('amenity_') || activeTool.startsWith('zone_') || activeTool === 'label_text' || activeTool === 'lot_rect') {
      let newObj = null;

      if (activeTool === 'lot_rect') {
        newObj = {
          id: `lot-${Date.now()}`,
          object_type: 'lot',
          object_data: {
            name: `Block A Lot ${Math.floor(Math.random() * 20) + 1}`,
            points: [
              clickedPoint.x - 30, clickedPoint.y - 40,
              clickedPoint.x + 30, clickedPoint.y - 40,
              clickedPoint.x + 30, clickedPoint.y + 40,
              clickedPoint.x - 30, clickedPoint.y + 40
            ],
            fillColor: '#10b981',
            borderColor: '#047857'
          },
          layer_order: 2,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'amenity_tree') {
        newObj = {
          id: `tree-${Date.now()}`,
          object_type: 'tree',
          object_data: { x: clickedPoint.x, y: clickedPoint.y, radius: 12, fill: '#059669' },
          layer_order: 3,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'amenity_clubhouse') {
        newObj = {
          id: `clubhouse-${Date.now()}`,
          object_type: 'clubhouse',
          object_data: { x: clickedPoint.x, y: clickedPoint.y, width: 90, height: 60, fill: '#0ea5e9', name: 'Grand Clubhouse' },
          layer_order: 3,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'amenity_pool') {
        newObj = {
          id: `pool-${Date.now()}`,
          object_type: 'pool',
          object_data: { x: clickedPoint.x, y: clickedPoint.y, width: 80, height: 45, fill: '#0284c7' },
          layer_order: 3,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'amenity_guard') {
        newObj = {
          id: `guard-${Date.now()}`,
          object_type: 'guard_house',
          object_data: { x: clickedPoint.x, y: clickedPoint.y, radius: 15, fill: '#f43f5e', name: 'Security Guardhouse' },
          layer_order: 3,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'amenity_light') {
        newObj = {
          id: `light-${Date.now()}`,
          object_type: 'street_light',
          object_data: { x: clickedPoint.x, y: clickedPoint.y, radius: 8, fill: '#fbbf24' },
          layer_order: 3,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'label_text') {
        newObj = {
          id: `label-${Date.now()}`,
          object_type: 'label',
          object_data: { x: clickedPoint.x, y: clickedPoint.y, text: 'New Street Label', fill: '#272727', fontSize: 13 },
          layer_order: 4,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'zone_flood') {
        newObj = {
          id: `zone-${Date.now()}`,
          object_type: 'zone',
          object_data: {
            label: 'High Flood Risk Zone',
            color: '#f43f5e',
            opacity: 0.35,
            points: [
              clickedPoint.x - 100, clickedPoint.y - 60,
              clickedPoint.x + 100, clickedPoint.y - 60,
              clickedPoint.x + 100, clickedPoint.y + 60,
              clickedPoint.x - 100, clickedPoint.y + 60
            ]
          },
          layer_order: 0,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'zone_noise') {
        newObj = {
          id: `zone-${Date.now()}`,
          object_type: 'zone',
          object_data: {
            label: 'Clubhouse Noise Zone',
            color: '#eab308',
            opacity: 0.25,
            points: [
              clickedPoint.x - 80, clickedPoint.y - 80,
              clickedPoint.x + 80, clickedPoint.y - 80,
              clickedPoint.x + 80, clickedPoint.y + 80,
              clickedPoint.x - 80, clickedPoint.y + 80
            ]
          },
          layer_order: 0,
          is_visible: true,
          is_locked: false
        };
      }

      if (newObj) {
        setObjects([...objects, newObj]);
        // Keep active tool for consecutive placements
      }
    }
  };

  // Previewing segment paths while moving cursor
  const handleStageMouseMove = (e) => {
    const pos = getRelativePointerPosition();
    let currentPoint = { x: pos.x, y: pos.y };

    if (snapEnabled) {
      const snap = findNearestSnapPoint(currentPoint, objects, 15, gridEnabled, 20);
      if (snap) {
        currentPoint = { x: snap.x, y: snap.y };
        setSnapIndicator(snap);
      } else {
        setSnapIndicator(null);
      }
    } else {
      setSnapIndicator(null);
    }

    if (drawingPoints.length > 0) {
      setTempPoint(currentPoint);
    }
  };

  // Finishes drawing roads on double click or right click
  const handleStageDoubleClick = () => {
    if ((activeTool === 'road_straight' || activeTool === 'road_curved') && drawingPoints.length >= 4) {
      const name = `Street ${Math.floor(Math.random() * 100) + 1}`;
      const type = activeTool === 'road_curved' ? 'secondary' : 'secondary';
      const width = activeTool === 'road_curved' ? 30 : 30;

      const newRoad = {
        id: `road-${Date.now()}`,
        village_id: null,
        blueprint_id: null,
        object_type: 'road',
        object_data: {
          name,
          roadType: type,
          points: [...drawingPoints],
          width,
          borderThickness: 5,
          asphaltColor: '#cbd5e1',
          borderColor: '#475569',
          tension: activeTool === 'road_curved' ? 0.35 : 0
        },
        layer_order: 1,
        is_visible: true,
        is_locked: false
      };

      setObjects([...objects, newRoad]);
      cancelDrawing();
      // Keep active tool for consecutive placements
    }
  };

  // Handles drag-and-drops of elements
  const handleDragEnd = (e, objectId) => {
    const stage = stageRef.current;
    if (!stage) return;

    let deltaX = e.target.x();
    let deltaY = e.target.y();

    // Snap to grid if locked dragging
    if (snapEnabled && gridEnabled) {
      deltaX = snapToGrid(deltaX, 20);
      deltaY = snapToGrid(deltaY, 20);
      e.target.x(deltaX);
      e.target.y(deltaY);
    }

    const updated = objects.map((obj) => {
      if (obj.id === objectId) {
        const data = { ...obj.object_data };
        if (data.points) {
          // Transform individual polyline vertices relative to delta
          data.points = data.points.map((val, idx) => idx % 2 === 0 ? val + deltaX : val + deltaY);
          // Reset line/polygon offsets so next drag starts relative to 0 again
          e.target.x(0);
          e.target.y(0);
        } else {
          // For absolute x/y shapes, deltaX/deltaY is already the new absolute coordinate on the canvas stage.
          // Do not add to original x/y and do not reset target position to 0.
          data.x = deltaX;
          data.y = deltaY;
        }

        return { ...obj, object_data: data };
      }
      return obj;
    });

    setObjects(updated);
  };

  // Auto-Transformer bounding box hook
  useEffect(() => {
    if (selectedObjectId) {
      const selectedNode = stageRef.current.findOne('#' + selectedObjectId);
      if (selectedNode && transformerRef.current) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedObjectId]);

  const sortedObjects = [...objects].sort((a, b) => (a.layer_order || 0) - (b.layer_order || 0));

  return (
    <div className="flex-1 bg-slate-950 relative overflow-hidden h-full canvas-grid-bg">
      <Stage
        width={1000}
        height={700}
        ref={stageRef}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onDblClick={handleStageDoubleClick}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          cancelDrawing();
        }}
        draggable={activeTool === 'pan' || activeTool === 'select' || activeTool === 'multi_select'}
        className="cursor-crosshair"
      >
        {/* Layer 1: Roads & Streets */}
        {layersVisible.roads !== false && (
          <Layer>
            {/* Draw double-pass: First Border stroke */}
            {sortedObjects
              .filter(o => o.object_type === 'road')
              .map((road) => {
                const data = road.object_data || {};
                const width = data.width || 30;
                const border = data.borderThickness || 5;
                
                return (
                  <Line
                    key={`border-${road.id}`}
                    points={data.points || []}
                    stroke={data.borderColor || '#334155'}
                    strokeWidth={width + border * 2}
                    lineCap="round"
                    lineJoin="round"
                    tension={data.tension || 0}
                    opacity={road.is_visible ? 1 : 0}
                  />
                );
              })}

            {/* Draw double-pass: Second Asphalt fill */}
            {sortedObjects
              .filter(o => o.object_type === 'road')
              .map((road) => {
                const data = road.object_data || {};
                return (
                  <Line
                    key={`asphalt-${road.id}`}
                    id={road.id}
                    points={data.points || []}
                    stroke={selectedObjectIds.includes(road.id) ? '#fbbf24' : (data.asphaltColor || '#cbd5e1')}
                    strokeWidth={data.width || 30}
                    lineCap="round"
                    lineJoin="round"
                    tension={data.tension || 0}
                    opacity={road.is_visible ? 1 : 0}
                    onClick={() => handleSelectObject(road.id)}
                    draggable={(activeTool === 'select' || activeTool === 'multi_select') && !road.is_locked}
                    onDragEnd={(e) => handleDragEnd(e, road.id)}
                  />
                );
              })}
          </Layer>
        )}

        {/* Layer 2: Lot boundaries */}
        {layersVisible.lots !== false && (
          <Layer>
            {sortedObjects
              .filter(o => o.object_type === 'lot' || o.object_type === 'house')
              .map((lot) => {
                const data = lot.object_data || {};
                const isSelected = selectedObjectIds.includes(lot.id);
                
                return (
                  <Group
                    key={lot.id}
                    id={lot.id}
                    draggable={(activeTool === 'select' || activeTool === 'multi_select') && !lot.is_locked}
                    onDragEnd={(e) => handleDragEnd(e, lot.id)}
                    onClick={() => handleSelectObject(lot.id)}
                  >
                    <Line
                      points={data.points || []}
                      fill={data.fillColor || '#10b981'}
                      stroke={isSelected ? '#fbbf24' : (data.borderColor || '#047857')}
                      strokeWidth={isSelected ? 3 : 1.5}
                      closed={true}
                      opacity={lot.is_visible ? 0.65 : 0}
                    />
                    {data.points && data.points.length >= 4 && (
                      <Text
                        text={data.name || ''}
                        x={data.points[0]}
                        y={data.points[1] - 12}
                        fontSize={10}
                        fontStyle="bold"
                        fill="#272727"
                        opacity={lot.is_visible ? 1 : 0}
                      />
                    )}
                  </Group>
                );
              })}
          </Layer>
        )}

        {/* Layer 3: Amenities and zones */}
        <Layer>
          {/* Hazards & Environmental zones */}
          {layersVisible.flood !== false && sortedObjects
            .filter(o => o.object_type === 'zone')
            .map((zone) => {
              const data = zone.object_data || {};
              return (
                <Line
                  key={zone.id}
                  id={zone.id}
                  points={data.points || []}
                  fill={data.color || '#f43f5e'}
                  closed={true}
                  stroke={selectedObjectIds.includes(zone.id) ? '#fbbf24' : 'transparent'}
                  strokeWidth={selectedObjectIds.includes(zone.id) ? 3 : 0}
                  opacity={zone.is_visible ? (data.opacity || 0.3) : 0}
                  draggable={(activeTool === 'select' || activeTool === 'multi_select') && !zone.is_locked}
                  onDragEnd={(e) => handleDragEnd(e, zone.id)}
                  onClick={() => handleSelectObject(zone.id)}
                />
              );
            })}

          {/* Trees / Lights / Landmarks */}
          {layersVisible.amenities !== false && sortedObjects
            .filter(o => o.object_type === 'tree' || o.object_type === 'street_light' || o.object_type === 'guard_house')
            .map((am) => {
              const data = am.object_data || {};
              const radius = data.radius || 12;
              
              return (
                <Circle
                  key={am.id}
                  id={am.id}
                  x={data.x || 0}
                  y={data.y || 0}
                  radius={radius}
                  fill={data.fill || '#10b981'}
                  stroke={selectedObjectIds.includes(am.id) ? '#fbbf24' : '#334155'}
                  strokeWidth={selectedObjectIds.includes(am.id) ? 3 : 1}
                  opacity={am.is_visible ? 0.9 : 0}
                  draggable={(activeTool === 'select' || activeTool === 'multi_select') && !am.is_locked}
                  onDragEnd={(e) => handleDragEnd(e, am.id)}
                  onClick={() => handleSelectObject(am.id)}
                />
              );
            })}

          {/* Sprawling Buildings (Clubhouse, pool) */}
          {layersVisible.amenities !== false && sortedObjects
            .filter(o => o.object_type === 'clubhouse' || o.object_type === 'pool')
            .map((b) => {
              const data = b.object_data || {};
              
              return (
                <Rect
                  key={b.id}
                  id={b.id}
                  x={data.x || 0}
                  y={data.y || 0}
                  width={data.width || 80}
                  height={data.height || 50}
                  fill={data.fill || '#0284c7'}
                  stroke={selectedObjectIds.includes(b.id) ? '#fbbf24' : '#1e293b'}
                  strokeWidth={selectedObjectIds.includes(b.id) ? 3 : 1.5}
                  cornerRadius={4}
                  opacity={b.is_visible ? 0.95 : 0}
                  draggable={(activeTool === 'select' || activeTool === 'multi_select') && !b.is_locked}
                  onDragEnd={(e) => handleDragEnd(e, b.id)}
                  onClick={() => handleSelectObject(b.id)}
                />
              );
            })}

          {/* Text Labels */}
          {sortedObjects
            .filter(o => o.object_type === 'label')
            .map((lbl) => {
              const data = lbl.object_data || {};
              return (
                <Text
                  key={lbl.id}
                  id={lbl.id}
                  x={data.x || 0}
                  y={data.y || 0}
                  text={data.text || ''}
                  fill={selectedObjectIds.includes(lbl.id) ? '#fbbf24' : (data.fill || '#272727')}
                  fontSize={data.fontSize || 12}
                  fontStyle="bold"
                  opacity={lbl.is_visible ? 1 : 0}
                  draggable={(activeTool === 'select' || activeTool === 'multi_select') && !lbl.is_locked}
                  onDragEnd={(e) => handleDragEnd(e, lbl.id)}
                  onClick={() => handleSelectObject(lbl.id)}
                />
              );
            })}
        </Layer>

        {/* Layer 4: Drawing Previews & Snap indicators */}
        <Layer>
          {/* Snap Proximity Indicator Dot */}
          {snapIndicator && (
            <Circle
              x={snapIndicator.x}
              y={snapIndicator.y}
              radius={6}
              fill="transparent"
              stroke="#fbbf24"
              strokeWidth={2}
              shadowColor="#fbbf24"
              shadowBlur={4}
            />
          )}

          {/* Drawing Polyline Preview lines */}
          {drawingPoints.length > 0 && tempPoint && (
            <Line
              points={[...drawingPoints, tempPoint.x, tempPoint.y]}
              stroke="#10b981"
              strokeWidth={activeTool.startsWith('road') ? 20 : 2}
              dash={[5, 5]}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Visual anchor dots for lot drawing */}
          {activeTool === 'lot_polygon' && drawingPoints.length > 0 && (
            <Circle
              x={drawingPoints[0]}
              y={drawingPoints[1]}
              radius={8}
              fill="transparent"
              stroke="#fbbf24"
              strokeWidth={2}
            />
          )}
        </Layer>
      </Stage>

      {/* Mini Legend overlay widget */}
      <div className="absolute bottom-4 left-4 p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center gap-4 text-[10px] select-none z-10 glass-card">
        <span className="font-bold text-slate-400 uppercase tracking-wider block">Editor Instructions</span>
        <div className="flex gap-3 text-slate-500 font-medium">
          <span>• Double-click to complete roads.</span>
          <span>• Click the start point (yellow circle) to complete lot polygons.</span>
          <span>• Press ESC to cancel drawing.</span>
        </div>
      </div>
    </div>
  );
}
