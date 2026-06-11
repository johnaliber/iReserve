export const AMENITY_TYPES = [
  ['recreation', 'Recreation Amenity'],
  ['community_facility', 'Community Facility'],
  ['security', 'Security Amenity'],
  ['outdoor', 'Outdoor Amenity'],
  ['utility', 'Utility Amenity'],
  ['parking', 'Parking Area'],
  ['commercial', 'Commercial Area'],
  ['landmark', 'Landmark'],
  ['other', 'Amenity']
];

export const AMENITY_SHAPES = [
  ['icon', 'Icon / Marker'],
  ['rectangle', 'Rectangle'],
  ['circle', 'Circle'],
  ['ellipse', 'Ellipse'],
  ['polygon', 'Polygon / Custom Shape']
];

const LEGACY_AMENITY_TYPES = new Set([
  'tree',
  'street_light',
  'guard_house',
  'clubhouse',
  'pool',
  'park',
  'landmark'
]);

export function isAmenityObject(object) {
  if (object?.object_data?.kind === 'reference_image') return false;
  return object?.object_type === 'amenity' || LEGACY_AMENITY_TYPES.has(object?.object_type);
}

export function getAmenityTypeLabel(type = 'other') {
  return AMENITY_TYPES.find(([value]) => value === type)?.[1] || 'Amenity';
}

export function getAmenityDefaults(object) {
  const data = object?.object_data || {};
  const legacyType = object?.object_type;
  const legacyDefaults = {
    tree: ['Tree', 'outdoor', 'icon', '#059669', '#047857'],
    street_light: ['Street Light', 'utility', 'icon', '#fbbf24', '#b45309'],
    guard_house: ['Guard House', 'security', 'icon', '#f43f5e', '#be123c'],
    clubhouse: ['Clubhouse', 'community_facility', 'rectangle', '#0ea5e9', '#0369a1'],
    pool: ['Swimming Pool', 'recreation', 'rectangle', '#38bdf8', '#0284c7'],
    park: ['Park', 'outdoor', 'circle', '#86efac', '#16a34a'],
    landmark: ['Landmark', 'landmark', 'icon', '#a78bfa', '#6d28d9']
  };
  const fallback = legacyDefaults[legacyType] || ['Amenity', 'other', 'icon', '#10b981', '#047857'];

  return {
    name: data.displayLabel || data.name || fallback[0],
    amenityType: data.amenityType || fallback[1],
    shapeType: data.shapeType || fallback[2],
    description: data.description || '',
    fillColor: data.fillColor || data.fill || fallback[3],
    borderColor: data.borderColor || fallback[4],
    opacity: data.opacity ?? 0.9,
    showLabel: data.showLabel ?? false,
    showTooltip: data.showTooltip ?? true,
    showInPublicMap: data.showInPublicMap ?? true,
    imageUrl: data.imageUrl || data.image_url || ''
  };
}

export function createAmenityData(tool, shapeType, point) {
  const presets = {
    amenity_tree: ['Tree', 'outdoor', '#059669', '#047857'],
    amenity_clubhouse: ['Clubhouse', 'community_facility', '#0ea5e9', '#0369a1'],
    amenity_pool: ['Swimming Pool', 'recreation', '#38bdf8', '#0284c7'],
    amenity_guard: ['Guard House', 'security', '#f43f5e', '#be123c'],
    amenity_light: ['Street Light', 'utility', '#fbbf24', '#b45309']
  };
  const [name, amenityType, fillColor, borderColor] = presets[tool] || ['Amenity', 'other', '#10b981', '#047857'];

  const dimensions = {
    icon: { width: 36, height: 36, radius: 18 },
    circle: { width: 56, height: 56, radius: 28 },
    ellipse: { width: 96, height: 60, radius: 30 },
    rectangle: { width: 100, height: 64, radius: 18 },
    polygon: { width: 0, height: 0, radius: 0 }
  }[shapeType] || { width: 36, height: 36, radius: 18 };

  return {
    name,
    displayLabel: name,
    amenityType,
    description: getAmenityTypeLabel(amenityType),
    shapeType,
    x: point.x,
    y: point.y,
    ...dimensions,
    fillColor,
    borderColor,
    opacity: 0.9,
    showLabel: false,
    showTooltip: true,
    showInPublicMap: true
  };
}
