import { createClient } from '@/lib/supabase/server';
import {
  generatePropertyCode,
  getNextLotNumber,
  normalizeNumberPart,
  normalizeVillageCode
} from '@/lib/properties/numbering';

export const dynamic = 'force-dynamic';

const REQUIRED_FIELDS = [
  'block_number',
  'lot_number',
  'property_type',
  'price',
  'reservation_fee',
  'lot_size',
  'status',
  'flood_risk',
  'sunlight_exposure'
];

const NUMERIC_FIELDS = new Set(['price', 'reservation_fee', 'lot_size', 'floor_area']);
const INTEGER_FIELDS = new Set(['bedrooms', 'bathrooms', 'parking_slots']);
const PROPERTY_FIELDS = [
  'property_code',
  'village_code',
  'phase_number',
  'block_number',
  'lot_number',
  'street_name',
  'property_type',
  'model_name',
  'description',
  'price',
  'reservation_fee',
  'lot_size',
  'floor_area',
  'bedrooms',
  'bathrooms',
  'parking_slots',
  'orientation',
  'flood_risk',
  'sunlight_exposure',
  'status',
  'thumbnail_url',
  'floor_plan_url',
  'notes',
  'maintenance_reason'
];

function json(status, payload) {
  return Response.json(payload, { status });
}

function normalizePayload(formData = {}) {
  const payload = {};

  for (const field of PROPERTY_FIELDS) {
    const rawValue = formData[field];
    if (rawValue === undefined) continue;

    if (NUMERIC_FIELDS.has(field)) {
      payload[field] = rawValue === '' || rawValue === null ? null : Number(rawValue);
      continue;
    }

    if (INTEGER_FIELDS.has(field)) {
      payload[field] = rawValue === '' || rawValue === null ? 0 : Number.parseInt(rawValue, 10);
      continue;
    }

    payload[field] = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  }

  payload.phase_number = normalizeNumberPart(payload.phase_number || '1');
  payload.block_number = normalizeNumberPart(payload.block_number);
  payload.lot_number = normalizeNumberPart(payload.lot_number);

  return payload;
}

function validatePayload(payload) {
  const missing = REQUIRED_FIELDS.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    return `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`;
  }

  for (const field of NUMERIC_FIELDS) {
    if (payload[field] !== undefined && payload[field] !== null && Number.isNaN(payload[field])) {
      return `${field.replaceAll('_', ' ')} must be a valid number`;
    }
  }

  if (payload.status === 'under_maintenance' && !payload.maintenance_reason) {
    return 'Maintenance reason is required when status is under maintenance';
  }

  return '';
}

async function getAuthorizedContext(supabase, villageId) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: json(401, { error: 'You must be signed in to edit blueprint properties.' }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: json(403, { error: 'Your profile could not be verified.' }) };
  }

  if (profile.role === 'super_admin') {
    return { user, profile, isSuperAdmin: true };
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('user_villages')
    .select('id')
    .eq('user_id', user.id)
    .eq('village_id', villageId)
    .eq('role', 'village_admin')
    .maybeSingle();

  if (assignmentError || !assignment) {
    return { error: json(403, { error: 'Only super admins or assigned village admins can edit this village.' }) };
  }

  return { user, profile, isSuperAdmin: false };
}

async function writeAuditLog(supabase, userId, villageId, action, entityId, metadata = {}) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    village_id: villageId,
    action,
    entity_type: 'property',
    entity_id: entityId,
    metadata
  });

  if (error) {
    console.warn('Audit log write failed:', error.message);
  }
}

async function savePropertyRecord(supabase, requestPropertyId, villageId, propertyPayload) {
  const runSave = (payload) => {
    if (requestPropertyId) {
      return supabase
        .from('properties')
        .update(payload)
        .eq('id', requestPropertyId)
        .eq('village_id', villageId)
        .select('*')
        .single();
    }

    return supabase
      .from('properties')
      .insert(payload)
      .select('*')
      .single();
  };

  let result = await runSave(propertyPayload);
  const missingOptionalColumns =
    result.error?.message?.includes('maintenance_reason') ||
    result.error?.message?.includes('notes') ||
    result.error?.message?.includes('village_code') ||
    result.error?.message?.includes('phase_number') ||
    result.error?.message?.includes('schema cache');

  if (missingOptionalColumns) {
    const fallbackPayload = { ...propertyPayload };
    delete fallbackPayload.notes;
    delete fallbackPayload.maintenance_reason;
    delete fallbackPayload.village_code;
    delete fallbackPayload.phase_number;
    result = await runSave(fallbackPayload);
  }

  return result;
}

async function getVillageDetails(supabase, villageId) {
  const { data: village, error } = await supabase
    .from('villages')
    .select('*')
    .eq('id', villageId)
    .single();

  if (error || !village) throw error || new Error('Village was not found.');
  return village;
}

async function assertNoDuplicateProperty(supabase, {
  villageId,
  propertyId,
  propertyCode,
  phaseNumber,
  blockNumber,
  lotNumber
}) {
  let codeQuery = supabase
    .from('properties')
    .select('id')
    .eq('property_code', propertyCode)
    .limit(1);

  if (propertyId) codeQuery = codeQuery.neq('id', propertyId);
  const { data: codeMatches, error: codeError } = await codeQuery;
  if (codeError) throw codeError;
  if (codeMatches?.length > 0) {
    return 'Property code already exists. Please check the phase, block, and lot number.';
  }

  let lotQuery = supabase
    .from('properties')
    .select('id')
    .eq('village_id', villageId)
    .eq('phase_number', phaseNumber)
    .eq('block_number', blockNumber)
    .eq('lot_number', lotNumber)
    .limit(1);

  if (propertyId) lotQuery = lotQuery.neq('id', propertyId);
  const { data: lotMatches, error: lotError } = await lotQuery;
  if (lotError) throw lotError;
  if (lotMatches?.length > 0) {
    return 'This lot number already exists in the selected phase and block.';
  }

  return '';
}

export async function GET(request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const villageId = searchParams.get('villageId');
  const phaseNumber = normalizeNumberPart(searchParams.get('phaseNumber') || '1');
  const blockNumber = normalizeNumberPart(searchParams.get('blockNumber'));
  const propertyId = searchParams.get('propertyId') || null;

  if (!villageId || !blockNumber) {
    return json(400, { error: 'Village and block number are required.' });
  }

  const authContext = await getAuthorizedContext(supabase, villageId);
  if (authContext.error) return authContext.error;

  try {
    const village = await getVillageDetails(supabase, villageId);
    const villageCode = normalizeVillageCode(village.village_code, village.name);
    const lotNumber = await getNextLotNumber(supabase, {
      villageId,
      phaseNumber,
      blockNumber,
      excludePropertyId: propertyId
    });

    return json(200, {
      villageCode,
      phaseNumber,
      blockNumber,
      lotNumber,
      propertyCode: generatePropertyCode({ villageCode, phaseNumber, blockNumber, lotNumber })
    });
  } catch (error) {
    return json(400, { error: error.message || 'Next lot number could not be generated.' });
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const body = await request.json();
  const { villageId, blueprintObjectId, propertyId, formData } = body || {};

  if (!villageId || !blueprintObjectId) {
    return json(400, { error: 'Village and blueprint object are required.' });
  }

  const authContext = await getAuthorizedContext(supabase, villageId);
  if (authContext.error) return authContext.error;

  const payload = normalizePayload(formData);
  const validationError = validatePayload(payload);
  if (validationError) {
    return json(400, { error: validationError });
  }

  const { data: object, error: objectError } = await supabase
    .from('blueprint_objects')
    .select('id, village_id, linked_property_id')
    .eq('id', blueprintObjectId)
    .eq('village_id', villageId)
    .maybeSingle();

  if (objectError || !object) {
    return json(404, { error: 'Blueprint object was not found in this village.' });
  }

  let village;
  try {
    village = await getVillageDetails(supabase, villageId);
  } catch (error) {
    return json(400, { error: error.message || 'Village details could not be loaded.' });
  }

  const requestPropertyId = propertyId || object.linked_property_id || null;
  const villageCode = normalizeVillageCode(payload.village_code || village.village_code, village.name);
  const phaseNumber = normalizeNumberPart(payload.phase_number || '1');
  const blockNumber = normalizeNumberPart(payload.block_number);
  let lotNumber = normalizeNumberPart(payload.lot_number);

  if (!requestPropertyId && (!lotNumber || formData?.autoLotNumber !== false)) {
    try {
      lotNumber = await getNextLotNumber(supabase, { villageId, phaseNumber, blockNumber });
    } catch (error) {
      return json(400, { error: error.message || 'Next lot number could not be generated.' });
    }
  }

  const propertyCode = generatePropertyCode({ villageCode, phaseNumber, blockNumber, lotNumber });
  if (!propertyCode) {
    return json(400, { error: 'Property code could not be generated from village, phase, block, and lot.' });
  }

  try {
    const duplicateError = await assertNoDuplicateProperty(supabase, {
      villageId,
      propertyId: requestPropertyId,
      propertyCode,
      phaseNumber,
      blockNumber,
      lotNumber
    });
    if (duplicateError) return json(409, { error: duplicateError });
  } catch (error) {
    return json(400, { error: error.message || 'Duplicate property validation failed.' });
  }

  const propertyPayload = {
    ...payload,
    village_code: villageCode,
    phase_number: phaseNumber,
    block_number: blockNumber,
    lot_number: lotNumber,
    property_code: propertyCode,
    village_id: villageId,
    blueprint_object_id: blueprintObjectId,
    updated_at: new Date().toISOString()
  };

  const { data: savedProperty, error: saveError } = await savePropertyRecord(
    supabase,
    requestPropertyId,
    villageId,
    propertyPayload
  );

  if (saveError || !savedProperty) {
    return json(400, { error: saveError?.message || 'Property could not be saved.' });
  }

  const { error: linkError } = await supabase
    .from('blueprint_objects')
    .update({ linked_property_id: savedProperty.id, updated_at: new Date().toISOString() })
    .eq('id', blueprintObjectId)
    .eq('village_id', villageId);

  if (linkError) {
    return json(400, {
      error: `Property was saved, but the blueprint object could not be linked: ${linkError.message}`
    });
  }

  await writeAuditLog(
    supabase,
    authContext.user.id,
    villageId,
    requestPropertyId ? 'property.updated_from_blueprint' : 'property.created_from_blueprint',
    savedProperty.id,
    { blueprintObjectId }
  );

  return json(200, { property: savedProperty });
}

export async function DELETE(request) {
  const supabase = await createClient();
  const body = await request.json();
  const { villageId, blueprintObjectId, propertyId, mode = 'delete' } = body || {};

  if (!villageId || !blueprintObjectId || !propertyId) {
    return json(400, { error: 'Village, blueprint object, and property are required.' });
  }

  const authContext = await getAuthorizedContext(supabase, villageId);
  if (authContext.error) return authContext.error;

  if (!authContext.isSuperAdmin) {
    return json(403, { error: 'Only super admins can delete or unlink blueprint properties.' });
  }

  const { data: activeReservations, error: reservationError } = await supabase
    .from('reservations')
    .select('id')
    .eq('property_id', propertyId)
    .not('status', 'in', '(cancelled,rejected,expired)')
    .limit(1);

  if (reservationError) {
    return json(400, { error: reservationError.message });
  }

  if (activeReservations?.length > 0) {
    return json(409, { error: 'This property has an active reservation and cannot be deleted or unlinked.' });
  }

  const { error: unlinkError } = await supabase
    .from('blueprint_objects')
    .update({ linked_property_id: null, updated_at: new Date().toISOString() })
    .eq('id', blueprintObjectId)
    .eq('village_id', villageId);

  if (unlinkError) {
    return json(400, { error: unlinkError.message });
  }

  if (mode === 'delete') {
    const { error: deleteError } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)
      .eq('village_id', villageId);

    if (deleteError) {
      return json(400, { error: deleteError.message });
    }
  } else {
    const { error: detachError } = await supabase
      .from('properties')
      .update({ blueprint_object_id: null, updated_at: new Date().toISOString() })
      .eq('id', propertyId)
      .eq('village_id', villageId);

    if (detachError) {
      return json(400, { error: detachError.message });
    }
  }

  await writeAuditLog(
    supabase,
    authContext.user.id,
    villageId,
    mode === 'delete' ? 'property.deleted_from_blueprint' : 'property.unlinked_from_blueprint',
    propertyId,
    { blueprintObjectId }
  );

  return json(200, { ok: true });
}
