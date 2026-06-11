'use client';

import React, { memo, useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text, Group, Transformer, Shape, Ellipse, Image as KonvaImage } from 'react-konva';
import { createAmenityData, getAmenityDefaults, isAmenityObject } from '@/lib/blueprints/amenities';
import { findNearestSnapPoint, snapToGrid } from '@/lib/editor/snapUtils';

const STAGE_WIDTH = 3000;
const STAGE_HEIGHT = 2200;

function getPointsBox(points = []) {
  const xs = points.filter((_, idx) => idx % 2 === 0);
  const ys = points.filter((_, idx) => idx % 2 === 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function getLocalPointShape(points = []) {
  const box = getPointsBox(points);
  return {
    ...box,
    points: points.map((value, idx) => (
      idx % 2 === 0 ? value - box.x : value - box.y
    ))
  };
}

function getLocalCurveControls(points = [], controls = []) {
  const box = getPointsBox(points);
  return (controls || []).map((control) => ({
    x: control.x - box.x,
    y: control.y - box.y
  }));
}

function applyNodeTransformToPoint(x, y, sourceBox, node) {
  const radians = (node.rotation() * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localX = (x - sourceBox.x) * node.scaleX();
  const localY = (y - sourceBox.y) * node.scaleY();

  return {
    x: node.x() + localX * cos - localY * sin,
    y: node.y() + localX * sin + localY * cos
  };
}

function objectClientBox(object) {
  const data = object.object_data || {};
  if (data.points?.length >= 2) return getPointsBox(data.points);
  if (data.radius) {
    return {
      x: (data.x || 0) - data.radius,
      y: (data.y || 0) - data.radius,
      width: data.radius * 2,
      height: data.radius * 2
    };
  }
  return {
    x: data.x || 0,
    y: data.y || 0,
    width: data.width || Math.max(20, String(data.text || '').length * (data.fontSize || 12)),
    height: data.height || data.fontSize || 20
  };
}

function boxesIntersect(a, b) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
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

const ImageLayerObject = memo(function ImageLayerObject({ object, isSelected, canDrag, onSelect, onDragStart, onDragMove, onDragEnd }) {
  const [image, setImage] = useState(null);
  const data = object.object_data || {};
  const imageUrl = data.image_url || data.imageUrl;

  useEffect(() => {
    if (!imageUrl) {
      return undefined;
    }

    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = imageUrl;
    return undefined;
  }, [imageUrl]);

  if (!image || object.is_visible === false || data.showInEditor === false) return null;

  return (
    <KonvaImage
      id={object.id}
      image={image}
      x={data.x || 0}
      y={data.y || 0}
      width={data.width || 600}
      height={data.height || 400}
      rotation={data.rotation || 0}
      opacity={data.opacity ?? 0.6}
      stroke={isSelected ? '#fbbf24' : 'transparent'}
      strokeWidth={isSelected ? 2 : 0}
      draggable={canDrag}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      listening={true}
    />
  );
});

export default function CanvasStage({
  objects,
  setObjects,
  commitObjects,
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
  onSaveDraft,
  onAddImageLayerFile,
  amenityShapeMode = 'icon'
}) {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const dragSessionRef = useRef(null);

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [tempPoint, setTempPoint] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [spacePanActive, setSpacePanActive] = useState(false);

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setTempPoint(null);
  };

  const handleSelectObject = (id) => {
    if (activeTool !== 'select' && activeTool !== 'multi_select') return;
    
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
      const target = e.target;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        cancelDrawing();
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePanActive(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setSpacePanActive(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
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
      if ((activeTool === 'select' || activeTool === 'multi_select') && !spacePanActive) {
        const pos = getRelativePointerPosition();
        setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0, startX: pos.x, startY: pos.y });
        setIsSelecting(true);
        setSelectedObjectId(null);
        setSelectedObjectIds([]);
        return;
      }
    }

    if (activeTool === 'pan' || spacePanActive || e.evt.button === 1) {
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
    // B. Handle polygon boundary drawing
    else if (activeTool === 'lot_polygon' || (activeTool.startsWith('amenity_') && amenityShapeMode === 'polygon')) {
      // Check if clicking near starting vertex to close the polygon
      if (drawingPoints.length >= 6) {
        const startX = drawingPoints[0];
        const startY = drawingPoints[1];
        const dist = Math.sqrt((clickedPoint.x - startX) ** 2 + (clickedPoint.y - startY) ** 2);
        
        if (dist < 15) {
          // Close polygon shape!
          const polygonObject = activeTool === 'lot_polygon'
            ? {
                id: `lot-${Date.now()}`,
                village_id: null,
                blueprint_id: null,
                object_type: 'lot',
                object_data: {
                  points: [...drawingPoints],
                  fillColor: '#10b981',
                  borderColor: '#047857'
                },
                layer_order: 4,
                is_visible: true,
                is_locked: false
              }
            : {
                id: `amenity-${Date.now()}`,
                object_type: 'amenity',
                object_data: {
                  ...createAmenityData(activeTool, 'polygon', clickedPoint),
                  points: [...drawingPoints]
                },
                layer_order: 5,
                is_visible: true,
                is_locked: false
              };
          commitObjects([...objects, polygonObject]);
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
            points: [
              clickedPoint.x - 30, clickedPoint.y - 40,
              clickedPoint.x + 30, clickedPoint.y - 40,
              clickedPoint.x + 30, clickedPoint.y + 40,
              clickedPoint.x - 30, clickedPoint.y + 40
            ],
            fillColor: '#10b981',
            borderColor: '#047857'
          },
          layer_order: 4,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool.startsWith('amenity_')) {
        newObj = {
          id: `amenity-${Date.now()}`,
          object_type: 'amenity',
          object_data: createAmenityData(activeTool, amenityShapeMode, clickedPoint),
          layer_order: 5,
          is_visible: true,
          is_locked: false
        };
      } else if (activeTool === 'label_text') {
        newObj = {
          id: `label-${Date.now()}`,
          object_type: 'label',
          object_data: {
            x: clickedPoint.x,
            y: clickedPoint.y,
            width: 180,
            text: 'New Street Label',
            fill: '#272727',
            fontSize: 13,
            fontFamily: 'Inter',
            fontStyle: 'bold',
            align: 'left'
          },
          layer_order: 6,
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
          layer_order: 3,
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
          layer_order: 3,
          is_visible: true,
          is_locked: false
        };
      }

      if (newObj) {
        commitObjects([...objects, newObj]);
        // Keep active tool for consecutive placements
      }
    }
  };

  // Previewing segment paths while moving cursor
  const handleStageMouseMove = (e) => {
    const pos = getRelativePointerPosition();
    let currentPoint = { x: pos.x, y: pos.y };

    if (isSelecting && selectionBox) {
      const nextBox = {
        ...selectionBox,
        x: Math.min(selectionBox.startX, currentPoint.x),
        y: Math.min(selectionBox.startY, currentPoint.y),
        width: Math.abs(currentPoint.x - selectionBox.startX),
        height: Math.abs(currentPoint.y - selectionBox.startY)
      };
      setSelectionBox(nextBox);
      return;
    }

    if (snapEnabled) {
      const snap = findNearestSnapPoint(currentPoint, objects, 15, gridEnabled, 20);
      if (snap) {
        currentPoint = { x: snap.x, y: snap.y };
      }
    }

    if (drawingPoints.length > 0) {
      setTempPoint(currentPoint);
    }
  };

  const handleStageMouseUp = () => {
    if (!isSelecting || !selectionBox) return;

    const selectedIds = objects
      .filter((object) => object.is_visible !== false)
      .filter((object) => boxesIntersect(selectionBox, objectClientBox(object)))
      .map((object) => object.id);

    setSelectedObjectIds(selectedIds);
    setSelectedObjectId(selectedIds[selectedIds.length - 1] || null);
    setSelectionBox(null);
    setIsSelecting(false);
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
          curveMode: activeTool === 'road_curved' ? 'pen' : 'straight',
          curveControls: activeTool === 'road_curved' ? buildCurveControls(drawingPoints) : [],
          width,
          borderThickness: 5,
          asphaltColor: '#cbd5e1',
          borderColor: '#475569',
          tension: 0
        },
        layer_order: 2,
        is_visible: true,
        is_locked: false
      };

      commitObjects([...objects, newRoad]);
      cancelDrawing();
      // Keep active tool for consecutive placements
    }
    if (activeTool.startsWith('amenity_') && amenityShapeMode === 'polygon' && drawingPoints.length >= 6) {
      const newAmenity = {
        id: `amenity-${Date.now()}`,
        object_type: 'amenity',
        object_data: {
          ...createAmenityData(activeTool, 'polygon', {
            x: drawingPoints[0],
            y: drawingPoints[1]
          }),
          points: [...drawingPoints]
        },
        layer_order: 5,
        is_visible: true,
        is_locked: false
      };
      commitObjects([...objects, newAmenity]);
      cancelDrawing();
    }
  };

  // Handles drag-and-drops of elements
  const moveObjectData = (object, deltaX, deltaY) => {
    const data = { ...object.object_data };
    if (data.points) {
      data.points = data.points.map((val, idx) => idx % 2 === 0 ? val + deltaX : val + deltaY);
      if (Array.isArray(data.curveControls)) {
        data.curveControls = data.curveControls.map((control) => ({
          x: control.x + deltaX,
          y: control.y + deltaY
        }));
      }
    } else {
      data.x = (data.x || 0) + deltaX;
      data.y = (data.y || 0) + deltaY;
    }
    return { ...object, object_data: data };
  };

  const handleObjectDragStart = (e, objectId) => {
    if (!selectedObjectIds.includes(objectId) || selectedObjectIds.length <= 1 || !stageRef.current) {
      dragSessionRef.current = null;
      return;
    }

    const nodePositions = new Map();
    selectedObjectIds.forEach((id) => {
      const node = stageRef.current.findOne('#' + id);
      if (node) {
        nodePositions.set(id, { x: node.x(), y: node.y() });
      }
    });

    dragSessionRef.current = {
      primaryId: objectId,
      startX: e.target.x(),
      startY: e.target.y(),
      nodePositions
    };
  };

  const handleObjectDragMove = (e, objectId) => {
    const session = dragSessionRef.current;
    if (!session || session.primaryId !== objectId) return;

    const deltaX = e.target.x() - session.startX;
    const deltaY = e.target.y() - session.startY;

    session.nodePositions.forEach((position, id) => {
      if (id === objectId) return;
      const node = stageRef.current?.findOne('#' + id);
      if (!node) return;
      node.x(position.x + deltaX);
      node.y(position.y + deltaY);
    });

    stageRef.current?.batchDraw();
  };

  const handleStageDragEnd = (e) => {
    if (e.target !== stageRef.current) {
      return;
    }

    setStagePos({ x: e.target.x(), y: e.target.y() });
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files || []).find((item) => item.type?.startsWith('image/'));
    if (!file || !stageRef.current) return;

    const rect = stageRef.current.container().getBoundingClientRect();
    const position = {
      x: (e.clientX - rect.left - stageRef.current.x()) / stageRef.current.scaleX(),
      y: (e.clientY - rect.top - stageRef.current.y()) / stageRef.current.scaleY()
    };
    onAddImageLayerFile?.(file, position);
  };

  const handleDragEnd = (e, objectId) => {
    e.cancelBubble = true;
    const stage = stageRef.current;
    if (!stage) return;

    const obj = objects.find((item) => item.id === objectId);
    if (!obj) return;

    const data = obj.object_data || {};
    if (!data.points) {
      let nextX = e.target.x();
      let nextY = e.target.y();

      const shouldSnap = snapEnabled && gridEnabled && data.kind !== 'reference_image';

      if (shouldSnap) {
        nextX = snapToGrid(nextX, 20);
        nextY = snapToGrid(nextY, 20);
        e.target.x(nextX);
        e.target.y(nextY);
      }

      const deltaX = nextX - (data.x || 0);
      const deltaY = nextY - (data.y || 0);
      const movingIds = selectedObjectIds.includes(objectId) && selectedObjectIds.length > 1
        ? selectedObjectIds
        : [objectId];

      commitObjects(objects.map((item) => {
        if (!movingIds.includes(item.id)) return item;
        return moveObjectData(item, deltaX, deltaY);
      }));
      return;
    }

    const sourceBox = getPointsBox(data.points);
    let nextX = e.target.x();
    let nextY = e.target.y();

    // Snap to grid if locked dragging
    if (snapEnabled && gridEnabled) {
      nextX = snapToGrid(nextX, 20);
      nextY = snapToGrid(nextY, 20);
      e.target.x(nextX);
      e.target.y(nextY);
    }

    const deltaX = nextX - sourceBox.x;
    const deltaY = nextY - sourceBox.y;
    const movingIds = selectedObjectIds.includes(objectId) && selectedObjectIds.length > 1
      ? selectedObjectIds
      : [objectId];

    const updated = objects.map((obj) => {
      if (!movingIds.includes(obj.id)) return obj;
      return moveObjectData(obj, deltaX, deltaY);
    });

    dragSessionRef.current = null;
    commitObjects(updated);
  };

  const handleTransformEnd = (e, objectId) => {
    const node = typeof e.target?.nodes === 'function'
      ? e.target.nodes()[0]
      : e.target;

    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const updated = objects.map((obj) => {
      if (obj.id !== objectId) return obj;

      const data = { ...obj.object_data };

      if (obj.object_type === 'label') {
        const currentFontSize = data.fontSize || 13;
        data.x = node.x();
        data.y = node.y();
        data.width = Math.max(40, node.width() * scaleX);
        data.fontSize = Math.max(8, currentFontSize * scaleY);
        data.rotation = node.rotation();
      } else if (data.points) {
        const sourceBox = getPointsBox(data.points);
        const nextPoints = [];
        for (let idx = 0; idx < data.points.length; idx += 2) {
          const transformed = applyNodeTransformToPoint(data.points[idx], data.points[idx + 1], sourceBox, node);
          nextPoints.push(transformed.x, transformed.y);
        }
        data.points = nextPoints;
        if (Array.isArray(data.curveControls)) {
          data.curveControls = data.curveControls.map((control) => (
            applyNodeTransformToPoint(control.x, control.y, sourceBox, node)
          ));
        }
        data.rotation = 0;
      } else {
        data.x = node.x();
        data.y = node.y();
        data.rotation = node.rotation();

        if (typeof data.width === 'number') {
          data.width = Math.max(1, node.width() * scaleX);
        }
        if (typeof data.height === 'number') {
          data.height = Math.max(1, node.height() * scaleY);
        }
        if (typeof data.radius === 'number') {
          data.radius = Math.max(1, data.radius * Math.max(scaleX, scaleY));
        }
      }

      node.scaleX(1);
      node.scaleY(1);
      node.rotation(data.points ? 0 : node.rotation());
      return { ...obj, object_data: data };
    });

    commitObjects(updated);
  };

  const updateCurveControl = (roadId, controlIndex, position, shouldCommit = false) => {
    const updater = shouldCommit ? commitObjects : setObjects;

    updater(objects.map((obj) => {
      if (obj.id !== roadId) return obj;

      const data = { ...obj.object_data };
      const controls = [...(data.curveControls || buildCurveControls(data.points || []))];
      controls[controlIndex] = position;

      return {
        ...obj,
        object_data: {
          ...data,
          curveMode: 'pen',
          curveControls: controls,
          tension: 0
        }
      };
    }));
  };

  // Auto-Transformer bounding box hook
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;

    if (selectedObjectIds.length === 0) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }

    const selectedNodes = selectedObjectIds
      .map((id) => stageRef.current.findOne('#' + id))
      .filter(Boolean);

    transformerRef.current.nodes(selectedNodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedObjectId, selectedObjectIds]);

  const sortedObjects = [...objects].sort((a, b) => (a.layer_order || 0) - (b.layer_order || 0));

  return (
    <div
      className="canvas-grid-bg relative h-full w-full min-h-0 min-w-0 flex-1 overflow-auto bg-[#e2e8f0]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <Stage
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={zoom}
        scaleY={zoom}
        ref={stageRef}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={handleStageDoubleClick}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          cancelDrawing();
        }}
        onDragEnd={handleStageDragEnd}
        draggable={activeTool === 'pan' || spacePanActive}
        className={activeTool === 'pan' || spacePanActive ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}
      >
        {/* Layer 0: Image layers */}
        {layersVisible.reference !== false && (
          <Layer>
            {sortedObjects
              .filter(o => o.object_type === 'image_layer' || (o.object_type === 'landmark' && o.object_data?.kind === 'reference_image'))
              .map((imageObject) => (
                <ImageLayerObject
                  key={imageObject.id}
                  object={imageObject}
                  isSelected={selectedObjectIds.includes(imageObject.id)}
                  canDrag={(activeTool === 'select' || activeTool === 'multi_select') && !imageObject.is_locked}
                  onSelect={() => handleSelectObject(imageObject.id)}
                  onDragStart={(e) => handleObjectDragStart(e, imageObject.id)}
                  onDragMove={(e) => handleObjectDragMove(e, imageObject.id)}
                  onDragEnd={(e) => handleDragEnd(e, imageObject.id)}
                />
              ))}
          </Layer>
        )}

        {/* Layer 1: Roads & Streets */}
        {layersVisible.roads !== false && (
          <Layer>
            {/* Draw double-pass: First Border stroke */}
            {sortedObjects
              .filter(o => o.object_type === 'road')
              .map((road) => {
                const data = road.object_data || {};
                const localShape = getLocalPointShape(data.points || []);
                const controls = data.curveControls || buildCurveControls(data.points || []);
                const localControls = getLocalCurveControls(data.points || [], controls);
                const width = data.width || 30;
                const border = data.borderThickness || 5;
                const isPenCurve = data.curveMode === 'pen' || (data.curveControls || []).length > 0;

                if (isPenCurve) {
                  return (
                    <Shape
                      key={`border-${road.id}`}
                      x={localShape.x}
                      y={localShape.y}
                      rotation={data.rotation || 0}
                      sceneFunc={(context, shape) => {
                        drawCurvePath(context, localShape.points, localControls);
                        context.strokeShape(shape);
                      }}
                      stroke={data.borderColor || '#334155'}
                      strokeWidth={width + border * 2}
                      lineCap="round"
                      lineJoin="round"
                      opacity={road.is_visible ? 1 : 0}
                      listening={false}
                    />
                  );
                }
                
                return (
                  <Line
                    key={`border-${road.id}`}
                    x={localShape.x}
                    y={localShape.y}
                    points={localShape.points}
                    stroke={data.borderColor || '#334155'}
                    strokeWidth={width + border * 2}
                    lineCap="round"
                    lineJoin="round"
                    tension={data.tension || 0}
                    rotation={data.rotation || 0}
                    opacity={road.is_visible ? 1 : 0}
                  />
                );
              })}

            {/* Draw double-pass: Second Asphalt fill */}
            {sortedObjects
              .filter(o => o.object_type === 'road')
              .map((road) => {
                const data = road.object_data || {};
                const localShape = getLocalPointShape(data.points || []);
                const controls = data.curveControls || buildCurveControls(data.points || []);
                const localControls = getLocalCurveControls(data.points || [], controls);
                const isPenCurve = data.curveMode === 'pen' || (data.curveControls || []).length > 0;

                if (isPenCurve) {
                  return (
                    <Shape
                      key={`asphalt-${road.id}`}
                      id={road.id}
                      x={localShape.x}
                      y={localShape.y}
                      rotation={data.rotation || 0}
                      sceneFunc={(context, shape) => {
                        drawCurvePath(context, localShape.points, localControls);
                        context.strokeShape(shape);
                      }}
                      stroke={selectedObjectIds.includes(road.id) ? '#fbbf24' : (data.asphaltColor || '#cbd5e1')}
                      strokeWidth={data.width || 30}
                      lineCap="round"
                      lineJoin="round"
                      opacity={road.is_visible ? 1 : 0}
                      onClick={() => handleSelectObject(road.id)}
                      draggable={(activeTool === 'select' || activeTool === 'multi_select') && !road.is_locked}
                      onDragStart={(e) => handleObjectDragStart(e, road.id)}
                      onDragMove={(e) => handleObjectDragMove(e, road.id)}
                      onDragEnd={(e) => handleDragEnd(e, road.id)}
                    />
                  );
                }

                return (
                  <Line
                    key={`asphalt-${road.id}`}
                    id={road.id}
                    x={localShape.x}
                    y={localShape.y}
                    points={localShape.points}
                    stroke={selectedObjectIds.includes(road.id) ? '#fbbf24' : (data.asphaltColor || '#cbd5e1')}
                    strokeWidth={data.width || 30}
                    lineCap="round"
                    lineJoin="round"
                    tension={data.tension || 0}
                    rotation={data.rotation || 0}
                    opacity={road.is_visible ? 1 : 0}
                    onClick={() => handleSelectObject(road.id)}
                    draggable={(activeTool === 'select' || activeTool === 'multi_select') && !road.is_locked}
                    onDragStart={(e) => handleObjectDragStart(e, road.id)}
                    onDragMove={(e) => handleObjectDragMove(e, road.id)}
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
                const localShape = getLocalPointShape(data.points || []);
                
                return (
                  <Group
                    key={lot.id}
                    id={lot.id}
                    x={localShape.x}
                    y={localShape.y}
                    draggable={(activeTool === 'select' || activeTool === 'multi_select') && !lot.is_locked}
                    onDragEnd={(e) => handleDragEnd(e, lot.id)}
                    onDragStart={(e) => handleObjectDragStart(e, lot.id)}
                    onDragMove={(e) => handleObjectDragMove(e, lot.id)}
                    onClick={() => handleSelectObject(lot.id)}
                    rotation={data.rotation || 0}
                    opacity={lot.is_visible ? (data.opacity ?? 1) : 0}
                  >
                    <Line
                      points={localShape.points}
                      fill={data.fillColor || '#10b981'}
                      stroke={isSelected ? '#fbbf24' : (data.borderColor || '#047857')}
                      strokeWidth={isSelected ? 3 : 1.5}
                      closed={true}
                      opacity={0.65}
                    />
                    {data.points && data.points.length >= 4 && (
                      <Text
                        text={data.name || ''}
                        x={localShape.points[0]}
                        y={localShape.points[1] - 12}
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
              const localShape = getLocalPointShape(data.points || []);
              return (
                <Line
                  key={zone.id}
                  id={zone.id}
                  x={localShape.x}
                  y={localShape.y}
                  points={localShape.points}
                  fill={data.color || '#f43f5e'}
                  closed={true}
                  stroke={selectedObjectIds.includes(zone.id) ? '#fbbf24' : 'transparent'}
                  strokeWidth={selectedObjectIds.includes(zone.id) ? 3 : 0}
                  opacity={zone.is_visible ? (data.opacity ?? 0.3) : 0}
                  rotation={data.rotation || 0}
                  draggable={(activeTool === 'select' || activeTool === 'multi_select') && !zone.is_locked}
                  onDragStart={(e) => handleObjectDragStart(e, zone.id)}
                  onDragMove={(e) => handleObjectDragMove(e, zone.id)}
                  onDragEnd={(e) => handleDragEnd(e, zone.id)}
                  onClick={() => handleSelectObject(zone.id)}
                />
              );
            })}

          {/* Amenities: legacy markers and new custom shapes */}
          {layersVisible.amenities !== false && sortedObjects
            .filter(isAmenityObject)
            .map((amenity) => {
              const data = amenity.object_data || {};
              const defaults = getAmenityDefaults(amenity);
              const isSelected = selectedObjectIds.includes(amenity.id);
              const canDrag = (activeTool === 'select' || activeTool === 'multi_select') && !amenity.is_locked;
              const sharedProps = {
                id: amenity.id,
                fill: defaults.fillColor,
                stroke: isSelected ? '#f59e0b' : defaults.borderColor,
                strokeWidth: isSelected ? 3 : 1.5,
                opacity: amenity.is_visible ? defaults.opacity : 0,
                rotation: data.rotation || 0,
                draggable: canDrag,
                onDragStart: (e) => handleObjectDragStart(e, amenity.id),
                onDragMove: (e) => handleObjectDragMove(e, amenity.id),
                onDragEnd: (e) => handleDragEnd(e, amenity.id),
                onClick: () => handleSelectObject(amenity.id)
              };
              let shape;
              let labelX = data.x || 0;
              let labelY = (data.y || 0) - 18;

              if (defaults.shapeType === 'polygon' && data.points?.length >= 6) {
                const localShape = getLocalPointShape(data.points);
                labelX = localShape.x;
                labelY = localShape.y - 18;
                shape = <Line {...sharedProps} x={localShape.x} y={localShape.y} points={localShape.points} closed lineJoin="round" />;
              } else if (defaults.shapeType === 'rectangle') {
                shape = <Rect {...sharedProps} x={data.x || 0} y={data.y || 0} width={data.width || 100} height={data.height || 64} cornerRadius={5} />;
              } else if (defaults.shapeType === 'ellipse') {
                shape = <Ellipse {...sharedProps} x={data.x || 0} y={data.y || 0} radiusX={(data.width || 90) / 2} radiusY={(data.height || 56) / 2} />;
              } else {
                shape = <Circle {...sharedProps} x={data.x || 0} y={data.y || 0} radius={data.radius || Math.max(10, (data.width || 36) / 2)} />;
              }

              return (
                <React.Fragment key={amenity.id}>
                  {shape}
                  {defaults.showLabel && amenity.is_visible !== false && (
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
                  width={data.width || 180}
                  fill={selectedObjectIds.includes(lbl.id) ? '#fbbf24' : (data.fill || '#272727')}
                  fontSize={data.fontSize || 12}
                  fontFamily={data.fontFamily || 'Inter'}
                  fontStyle={data.fontStyle || 'bold'}
                  align={data.align || 'left'}
                  opacity={lbl.is_visible ? (data.opacity ?? 1) : 0}
                  rotation={data.rotation || 0}
                  draggable={(activeTool === 'select' || activeTool === 'multi_select') && !lbl.is_locked}
                  onDragStart={(e) => handleObjectDragStart(e, lbl.id)}
                  onDragMove={(e) => handleObjectDragMove(e, lbl.id)}
                  onDragEnd={(e) => handleDragEnd(e, lbl.id)}
                  onClick={() => handleSelectObject(lbl.id)}
                />
              );
            })}
        </Layer>

        {/* Layer 4: Drawing Previews & Snap indicators */}
        <Layer>
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            resizeEnabled={selectedObjectIds.length <= 1}
            ignoreStroke={true}
            onTransformEnd={(e) => {
              if (selectedObjectId) {
                handleTransformEnd(e, selectedObjectId);
              }
            }}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 8 || newBox.height < 8) return oldBox;
              return newBox;
            }}
            anchorStroke="#10b981"
            anchorFill="#ffffff"
            anchorSize={14}
            anchorCornerRadius={4}
            rotateAnchorOffset={42}
            padding={8}
            borderStrokeWidth={2}
            borderStroke="#10b981"
            borderDash={[4, 4]}
          />

          {selectionBox && (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="#10b981"
              opacity={0.08}
              stroke="#10b981"
              strokeWidth={1.5}
              dash={[6, 4]}
            />
          )}

          {sortedObjects
            .filter((road) => (
              road.object_type === 'road' &&
              selectedObjectIds.includes(road.id) &&
              (road.object_data?.curveMode === 'pen' || (road.object_data?.curveControls || []).length > 0)
            ))
            .flatMap((road) => {
              const data = road.object_data || {};
              const controls = data.curveControls || buildCurveControls(data.points || []);

          return controls.map((control, idx) => {
                const startX = data.points[idx * 2];
                const startY = data.points[idx * 2 + 1];
                const endX = data.points[(idx + 1) * 2];
                const endY = data.points[(idx + 1) * 2 + 1];

                return (
                  <Group key={`${road.id}-curve-control-${idx}`}>
                    <Line
                      points={[startX, startY, control.x, control.y, endX, endY]}
                      stroke="#10b981"
                      strokeWidth={1}
                      dash={[4, 4]}
                      opacity={0.7}
                    />
                    <Circle
                      x={control.x}
                      y={control.y}
                      radius={9}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                        updateCurveControl(road.id, idx, { x: e.target.x(), y: e.target.y() });
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        updateCurveControl(road.id, idx, { x: e.target.x(), y: e.target.y() }, true);
                      }}
                    />
                  </Group>
                );
              });
            })}

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

        </Layer>
      </Stage>

      {/* Mini Legend overlay widget */}
      <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] select-none items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[10px] text-slate-600 shadow-lg backdrop-blur">
        <span className="block whitespace-nowrap font-extrabold uppercase tracking-wider text-emerald-700">Current tool help</span>
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium">
          <span>• Double-click to complete roads.</span>
          <span>• Click the first corner again to complete lot polygons.</span>
          <span>• Press ESC to cancel drawing.</span>
        </div>
      </div>
    </div>
  );
}
