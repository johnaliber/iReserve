// Default Road Presets & Styling Configurations for iReserve Blueprint Editor

export const ROAD_PRESETS = {
  main: {
    name: 'Main Road',
    width: 40,
    borderThickness: 6,
    asphaltColor: '#e2e8f0', // Light slate gray asphalt representation
    borderColor: '#334155',  // Dark border outline
  },
  secondary: {
    name: 'Secondary Road',
    width: 30,
    borderThickness: 5,
    asphaltColor: '#cbd5e1',
    borderColor: '#475569',
  },
  alley: {
    name: 'Alley',
    width: 20,
    borderThickness: 4,
    asphaltColor: '#94a3b8',
    borderColor: '#475569',
  },
  walkway: {
    name: 'Walkway',
    width: 12,
    borderThickness: 3,
    asphaltColor: '#64748b',
    borderColor: '#334155',
  }
};

/**
 * Fetch styling attributes of a road type
 */
export function getRoadPreset(type) {
  return ROAD_PRESETS[type] || ROAD_PRESETS.secondary;
}

/**
 * Factory to instantiate a standard road object model
 */
export function createRoadObject(villageId, blueprintId, name, roadType, points) {
  const preset = getRoadPreset(roadType);
  
  return {
    id: `road-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    village_id: villageId,
    blueprint_id: blueprintId,
    object_type: 'road',
    object_data: {
      name: name || 'Unnamed Road',
      roadType: roadType || 'secondary',
      points: points || [],
      width: preset.width,
      borderThickness: preset.borderThickness,
      asphaltColor: preset.asphaltColor,
      borderColor: preset.borderColor,
      connectedRoadIds: []
    },
    layer_order: 1, // Rendered low in layer layout order
    is_visible: true,
    is_locked: false
  };
}
