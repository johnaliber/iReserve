import { getDistance } from './geometry';

/**
 * Detect intersection between two finite line segments: Segment A (p1 to p2) and Segment B (p3 to p4).
 * Returns the intersection coordinates { x, y } if they cross, otherwise null.
 */
export function getLineIntersection(p1, p2, p3, p4) {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denom === 0) return null; // Parallel or collinear lines

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  // Confirm if crossing is within the bounds of the segments
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y)
    };
  }

  return null;
}

/**
 * Scan all segments of two multi-point road polyline paths to discover intersections.
 * Returns an array of intersection coordinates.
 */
export function getRoadIntersections(road1Points, road2Points) {
  const intersections = [];
  
  for (let i = 0; i < road1Points.length - 2; i += 2) {
    const p1 = { x: road1Points[i], y: road1Points[i+1] };
    const p2 = { x: road1Points[i+2], y: road1Points[i+3] };

    for (let j = 0; j < road2Points.length - 2; j += 2) {
      const p3 = { x: road2Points[j], y: road2Points[j+1] };
      const p4 = { x: road2Points[j+2], y: road2Points[j+3] };

      const cross = getLineIntersection(p1, p2, p3, p4);
      if (cross) {
        intersections.push(cross);
      }
    }
  }

  return intersections;
}
