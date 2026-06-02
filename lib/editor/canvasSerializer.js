// Blueprint Objects JSON Serializers for iReserve

/**
 * Format canvas objects list into a database-ready schema array.
 */
export function serializeObjects(objects) {
  return objects.map(obj => ({
    id: obj.id,
    village_id: obj.village_id,
    blueprint_id: obj.blueprint_id,
    object_type: obj.object_type,
    object_data: obj.object_data,
    linked_property_id: obj.linked_property_id || null,
    layer_order: obj.layer_order || 0,
    is_visible: obj.is_visible !== false,
    is_locked: obj.is_locked === true
  }));
}

/**
 * Parse database entries back into frontend Canvas state format.
 */
export function deserializeObjects(dbObjects) {
  if (!dbObjects) return [];
  return dbObjects.map(obj => ({
    id: obj.id,
    village_id: obj.village_id,
    blueprint_id: obj.blueprint_id,
    object_type: obj.object_type,
    object_data: typeof obj.object_data === 'string' ? JSON.parse(obj.object_data) : obj.object_data,
    linked_property_id: obj.linked_property_id,
    layer_order: obj.layer_order,
    is_visible: obj.is_visible,
    is_locked: obj.is_locked
  }));
}
