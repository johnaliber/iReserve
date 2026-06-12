const BASE_VISUAL_FIELDS = [
  'shapeType',
  'x',
  'y',
  'width',
  'height',
  'radius',
  'points',
  'rotation',
  'opacity',
  'fill',
  'fillColor',
  'borderColor',
  'strokeColor',
  'strokeWidth',
  'lineJoin',
  'lineCap',
  'dash',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'shadowOpacity'
];

const TYPE_VISUAL_FIELDS = {
  label: ['text', 'fontSize', 'fontFamily', 'fontStyle', 'align', 'verticalAlign'],
  road: [
    'name',
    'roadType',
    'curveMode',
    'curveControls',
    'borderThickness',
    'asphaltColor',
    'tension'
  ],
  zone: ['label', 'color'],
  image_layer: [
    'kind',
    'name',
    'image_url',
    'imageUrl',
    'showInEditor',
    'showInAdminPreview',
    'showInPublicMap',
    'preserveOnPublish'
  ]
};

const LEGACY_AMENITY_TYPES = new Set([
  'amenity',
  'tree',
  'street_light',
  'guard_house',
  'clubhouse',
  'pool',
  'park',
  'landmark'
]);

const AMENITY_FIELDS = [
  'name',
  'displayLabel',
  'amenityType',
  'description',
  'showLabel',
  'showTooltip',
  'showInPublicMap',
  'imageUrl',
  'image_url'
];

function cloneValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function copyAllowedFields(data, fields) {
  return fields.reduce((result, field) => {
    if (data[field] !== undefined) {
      result[field] = cloneValue(data[field]);
    }
    return result;
  }, {});
}

function offsetVisualData(data, offset) {
  const nextData = { ...data };

  if (Array.isArray(nextData.points)) {
    nextData.points = nextData.points.map((value) => value + offset);
  } else {
    nextData.x = (nextData.x || 0) + offset;
    nextData.y = (nextData.y || 0) + offset;
  }

  if (Array.isArray(nextData.curveControls)) {
    nextData.curveControls = nextData.curveControls.map((control) => ({
      ...control,
      x: (control.x || 0) + offset,
      y: (control.y || 0) + offset
    }));
  }

  return nextData;
}

function appendCopySuffix(value, fallback) {
  const name = String(value || fallback).trim();
  return /\scopy$/i.test(name) ? name : `${name} Copy`;
}

export function sanitizeObjectDataForDuplicate(object, offset = 24) {
  const objectType = object?.object_type || '';
  const data = object?.object_data || {};
  const isImageLayer = objectType === 'image_layer'
    || (objectType === 'landmark' && data.kind === 'reference_image');
  const typeFields = isImageLayer
    ? TYPE_VISUAL_FIELDS.image_layer
    : (TYPE_VISUAL_FIELDS[objectType] || []);
  const amenityFields = LEGACY_AMENITY_TYPES.has(objectType) && data.kind !== 'reference_image'
    ? AMENITY_FIELDS
    : [];
  const sanitized = copyAllowedFields(data, [
    ...BASE_VISUAL_FIELDS,
    ...typeFields,
    ...amenityFields
  ]);

  if (amenityFields.length > 0) {
    const copiedName = appendCopySuffix(data.name || data.displayLabel, 'Amenity');
    sanitized.name = copiedName;
    sanitized.displayLabel = copiedName;
  }

  return offsetVisualData(sanitized, offset);
}

export function prepareBlueprintObjectDuplicate(object, {
  id,
  layerOrder,
  offset = 24
} = {}) {
  return {
    id,
    village_id: object?.village_id || null,
    blueprint_id: object?.blueprint_id || null,
    object_type: object?.object_type,
    object_data: sanitizeObjectDataForDuplicate(object, offset),
    linked_property_id: null,
    layer_order: layerOrder ?? ((object?.layer_order || 0) + 1),
    is_visible: true,
    is_locked: false,
    duplicate_source_id: object?.id || null
  };
}
