import { getDistance } from './geometry';

/**
 * Snap a value to the nearest grid increment
 */
export function snapToGrid(val, gridSize = 20) {
  return Math.round(val / gridSize) * gridSize;
}

/**
 * Find the nearest snap target (road endpoints or lot corner vertices) within a threshold.
 * Falls back to grid snapping if enabled and no object snap is within threshold.
 * 
 * @param {Object} currentPoint - { x, y } input position
 * @param {Array} allObjects - Current list of blueprint_objects in state
 * @param {number} threshold - Snapping radius in pixels (default 15)
 * @param {boolean} snapToGridEnabled - Whether to snap to grid points
 * @param {number} gridSize - Grid interval size in pixels
 */
export function findNearestSnapPoint(currentPoint, allObjects, threshold = 15, snapToGridEnabled = false, gridSize = 20) {
  let bestSnap = null;
  let minDistance = threshold;

  // 1. Proximity scan over elements in layout
  for (const obj of allObjects) {
    // Only parse active visible components
    if (!obj.is_visible) continue;

    // Check roads: snap to their starting or ending endpoints
    if (obj.object_type === 'road') {
      const points = obj.object_data?.points || [];
      if (points.length >= 4) {
        const start = { x: points[0], y: points[1] };
        const end = { x: points[points.length - 2], y: points[points.length - 1] };

        const distStart = getDistance(currentPoint, start);
        if (distStart < minDistance) {
          minDistance = distStart;
          bestSnap = { x: start.x, y: start.y, source: 'road-endpoint', objectId: obj.id };
        }

        const distEnd = getDistance(currentPoint, end);
        if (distEnd < minDistance) {
          minDistance = distEnd;
          bestSnap = { x: end.x, y: end.y, source: 'road-endpoint', objectId: obj.id };
        }
      }
    } 
    // Check lot polygons or houses: snap to corner vertices
    else if (obj.object_type === 'lot' || obj.object_type === 'house') {
      const points = obj.object_data?.points || [];
      for (let i = 0; i < points.length; i += 2) {
        if (points[i] !== undefined && points[i+1] !== undefined) {
          const vertex = { x: points[i], y: points[i+1] };
          const dist = getDistance(currentPoint, vertex);
          if (dist < minDistance) {
            minDistance = dist;
            bestSnap = { x: vertex.x, y: vertex.y, source: 'lot-vertex', objectId: obj.id };
          }
        }
      }
    }
  }

  // 2. Fall back to grid snapping if no element terminals were captured in radius
  if (!bestSnap && snapToGridEnabled) {
    const gridX = snapToGrid(currentPoint.x, gridSize);
    const gridY = snapToGrid(currentPoint.y, gridSize);
    const gridPoint = { x: gridX, y: gridY };
    const distGrid = getDistance(currentPoint, gridPoint);
    
    if (distGrid < threshold) {
      bestSnap = { x: gridX, y: gridY, source: 'grid' };
    }
  }

  return bestSnap;
}
export { getDistance };
