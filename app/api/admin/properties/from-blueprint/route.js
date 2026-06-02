import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const REQUIRED_FIELDS = [
  'property_code',
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
    result.error?.message?.includes('schema cache');

  if (missingOptionalColumns) {
    const fallbackPayload = { ...propertyPayload };
    delete fallbackPayload.notes;
    delete fallbackPayload.maintenance_reason;
    result = await runSave(fallbackPayload);
  }

  return result;
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

  const propertyPayload = {
    ...payload,
    village_id: villageId,
    blueprint_object_id: blueprintObjectId,
    updated_at: new Date().toISOString()
  };

  const requestPropertyId = propertyId || object.linked_property_id || null;
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
