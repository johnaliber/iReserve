// Reusable Euclidean Geometry Helpers for iReserve Blueprint Editor

/**
 * Calculate distance between two points
 */
export function getDistance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Find the midpoint of two points
 */
export function getMidpoint(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Find the angle in radians between two points
 */
export function getAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Normalize a vector defined by two points
 */
export function normalizeVector(p1, p2) {
  const dist = getDistance(p1, p2);
  if (dist === 0) return { x: 0, y: 0 };
  return {
    x: (p2.x - p1.x) / dist,
    y: (p2.y - p1.y) / dist,
  };
}

/**
 * Get bounding box of a list of points
 */
export function getBoundingBox(points) {
  if (!points || points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate area of a polygon using Shoelace formula
 */
export function getPolygonArea(points) {
  let area = 0;
  const j = points.length - 1;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += (p1.x + p2.x) * (p1.y - p2.y);
  }

  return Math.abs(area / 2);
}

/**
 * Check if a point is inside a polygon using Raycasting algorithm
 * @param {Object} point - { x, y }
 * @param {Array} polygon - [{ x, y }, { x, y }, ...]
 */
export function isPointInPolygon(point, polygon) {
  const x = point.x;
  const y = point.y;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}
