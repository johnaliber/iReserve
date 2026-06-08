function normalizePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, '');
}

function getObjectBlockLot(object) {
  const data = object?.object_data || {};
  const block = normalizePart(data.block_number || data.blockNumber || data.block);
  const lot = normalizePart(data.lot_number || data.lotNumber || data.lot);

  if (block && lot) return { block, lot };

  const text = String(data.property_code || data.name || data.label || '');
  const verbose = text.match(/block\s*([a-z0-9-]+).*lot\s*([a-z0-9-]+)/i);
  if (verbose) {
    return { block: normalizePart(verbose[1]), lot: normalizePart(verbose[2]) };
  }

  const short = text.match(/\bb\s*([a-z0-9-]+)\s*[- ]?\s*l\s*([a-z0-9-]+)/i);
  return short
    ? { block: normalizePart(short[1]), lot: normalizePart(short[2]) }
    : null;
}

function getObjectPosition(object) {
  const data = object?.object_data || {};
  if (Array.isArray(data.points) && data.points.length >= 2) {
    const xs = data.points.filter((_, index) => index % 2 === 0);
    const ys = data.points.filter((_, index) => index % 2 === 1);
    return {
      x: xs.reduce((sum, value) => sum + Number(value || 0), 0) / xs.length,
      y: ys.reduce((sum, value) => sum + Number(value || 0), 0) / ys.length
    };
  }

  return { x: Number(data.x || 0), y: Number(data.y || 0) };
}

const naturalCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
});

function compareProperties(left, right) {
  const leftKey = [
    left.phase_number,
    left.block_number,
    left.lot_number,
    left.property_code
  ].map(normalizePart).join('::');
  const rightKey = [
    right.phase_number,
    right.block_number,
    right.lot_number,
    right.property_code
  ].map(normalizePart).join('::');

  return naturalCollator.compare(leftKey, rightKey);
}

function compareObjects(left, right) {
  const leftPosition = getObjectPosition(left);
  const rightPosition = getObjectPosition(right);

  return (
    leftPosition.y - rightPosition.y
    || leftPosition.x - rightPosition.x
    || naturalCollator.compare(String(left.id), String(right.id))
  );
}

function propertyIdentity(property) {
  return {
    ...(property.village_code ? { village_code: property.village_code } : {}),
    ...(property.phase_number ? { phase_number: property.phase_number } : {}),
    property_code: property.property_code,
    block_number: property.block_number,
    lot_number: property.lot_number,
    name: property.property_code
  };
}

function hasIdentity(objectData, identity) {
  return Object.entries(identity).every(([key, value]) => (
    String(objectData?.[key] || '') === String(value || '')
  ));
}

export async function reconcileBlueprintPropertyLinks(admin, villageSlug) {
  const { data: village, error: villageError } = await admin
    .from('villages')
    .select('id, slug')
    .eq('slug', villageSlug)
    .maybeSingle();

  if (villageError) throw villageError;
  if (!village) return { villageFound: false, linkedCount: 0 };

  const { data: blueprint, error: blueprintError } = await admin
    .from('blueprints')
    .select('id')
    .eq('village_id', village.id)
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (blueprintError) throw blueprintError;
  if (!blueprint) return { villageFound: true, blueprintFound: false, linkedCount: 0 };

  const [{ data: properties, error: propertiesError }, { data: objects, error: objectsError }] = await Promise.all([
    admin
      .from('properties')
      .select('id, blueprint_object_id, village_code, phase_number, property_code, block_number, lot_number')
      .eq('village_id', village.id),
    admin
      .from('blueprint_objects')
      .select('id, linked_property_id, object_type, object_data, layer_order, created_at')
      .eq('blueprint_id', blueprint.id)
      .in('object_type', ['lot', 'house'])
  ]);

  if (propertiesError) throw propertiesError;
  if (objectsError) throw objectsError;

  const propertyRows = properties || [];
  const objectRows = objects || [];
  const propertyById = new Map(propertyRows.map((property) => [property.id, property]));
  const objectById = new Map(objectRows.map((object) => [object.id, object]));
  const claimedPropertyIds = new Set();
  const claimedObjectIds = new Set();
  const pairs = [];

  const claim = (property, object, strategy) => {
    if (
      !property
      || !object
      || claimedPropertyIds.has(property.id)
      || claimedObjectIds.has(object.id)
    ) {
      return false;
    }

    claimedPropertyIds.add(property.id);
    claimedObjectIds.add(object.id);
    pairs.push({ property, object, strategy });
    return true;
  };

  for (const object of objectRows) {
    claim(propertyById.get(object.linked_property_id), object, 'object_link');
  }

  for (const property of propertyRows) {
    claim(property, objectById.get(property.blueprint_object_id), 'property_link');
  }

  const propertyByBlockLot = new Map(
    propertyRows
      .filter((property) => !claimedPropertyIds.has(property.id))
      .map((property) => [
        `${normalizePart(property.block_number)}::${normalizePart(property.lot_number)}`,
        property
      ])
  );

  for (const object of objectRows) {
    if (claimedObjectIds.has(object.id)) continue;
    const blockLot = getObjectBlockLot(object);
    if (!blockLot) continue;
    claim(propertyByBlockLot.get(`${blockLot.block}::${blockLot.lot}`), object, 'block_lot');
  }

  const remainingProperties = propertyRows
    .filter((property) => !claimedPropertyIds.has(property.id))
    .sort(compareProperties);
  const remainingObjects = objectRows
    .filter((object) => !claimedObjectIds.has(object.id))
    .sort(compareObjects);

  for (let index = 0; index < Math.min(remainingProperties.length, remainingObjects.length); index += 1) {
    claim(remainingProperties[index], remainingObjects[index], 'legacy_position');
  }

  let updatedCount = 0;
  for (const { property, object, strategy } of pairs) {
    const identity = propertyIdentity(property);
    const nextObjectData = {
      ...(object.object_data || {}),
      ...identity,
      property_link_strategy: strategy
    };

    const objectNeedsUpdate = (
      object.linked_property_id !== property.id
      || !hasIdentity(object.object_data, identity)
      || object.object_data?.property_link_strategy !== strategy
    );
    const propertyNeedsUpdate = property.blueprint_object_id !== object.id;

    const updates = [];
    if (objectNeedsUpdate) {
      updates.push(
        admin
          .from('blueprint_objects')
          .update({
            linked_property_id: property.id,
            object_data: nextObjectData,
            updated_at: new Date().toISOString()
          })
          .eq('id', object.id)
          .eq('blueprint_id', blueprint.id)
      );
    }
    if (propertyNeedsUpdate) {
      updates.push(
        admin
          .from('properties')
          .update({
            blueprint_object_id: object.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', property.id)
          .eq('village_id', village.id)
      );
    }

    if (updates.length === 0) continue;

    const updateResults = await Promise.all(updates);
    const updateError = updateResults.find((result) => result.error)?.error;

    if (updateError) throw updateError;
    updatedCount += 1;
  }

  return {
    villageFound: true,
    blueprintFound: true,
    linkedCount: pairs.length,
    updatedCount,
    unlinkedPropertyCount: Math.max(0, propertyRows.length - pairs.length),
    unlinkedObjectCount: Math.max(0, objectRows.length - pairs.length)
  };
}
