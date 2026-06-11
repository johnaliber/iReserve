import { getAuthContext } from '@/lib/auth/rbac';
import { isAmenityObject } from '@/lib/blueprints/amenities';

export const dynamic = 'force-dynamic';

function json(status, payload) {
  return Response.json(payload, { status });
}

async function getAuthorizedAmenity(objectId, villageId = null) {
  const context = await getAuthContext();
  const { admin, user, profile } = context;

  if (!user || !profile || !admin) {
    return { error: json(401, { error: 'Authentication required.' }) };
  }

  if (profile.status !== 'active') {
    return { error: json(403, { error: 'This account is not active.' }) };
  }

  const { data: object, error: objectError } = await admin
    .from('blueprint_objects')
    .select('*')
    .eq('id', objectId)
    .maybeSingle();

  if (objectError || !object || (villageId && object.village_id !== villageId)) {
    return { error: json(404, { error: 'Amenity object was not found in this village.' }) };
  }

  if (!isAmenityObject(object)) {
    return { error: json(400, { error: 'The selected blueprint object is not an amenity.' }) };
  }

  if (profile.role !== 'super_admin') {
    if (profile.role !== 'village_admin') {
      return { error: json(403, { error: 'Only assigned village admins can manage amenity details.' }) };
    }

    const { data: assignment, error: assignmentError } = await admin
      .from('user_villages')
      .select('id')
      .eq('user_id', user.id)
      .eq('village_id', object.village_id)
      .eq('role', 'village_admin')
      .maybeSingle();

    if (assignmentError || !assignment) {
      return { error: json(403, { error: 'You are not assigned to manage this village.' }) };
    }
  }

  return { admin, user, object };
}

function buildAmenityData(currentData, details = {}) {
  const nextData = { ...currentData };
  const stringFields = ['name', 'displayLabel', 'amenityType', 'description'];
  const booleanFields = ['showLabel', 'showTooltip', 'showInPublicMap'];

  for (const field of stringFields) {
    if (details[field] !== undefined) {
      nextData[field] = String(details[field] ?? '').trim();
    }
  }

  for (const field of booleanFields) {
    if (details[field] !== undefined) {
      nextData[field] = Boolean(details[field]);
    }
  }

  if (details.imageUrl !== undefined) {
    const imageUrl = details.imageUrl ? String(details.imageUrl).trim() : null;
    nextData.imageUrl = imageUrl;
    nextData.image_url = imageUrl;
  }

  if (details.name !== undefined && details.displayLabel === undefined) {
    nextData.displayLabel = String(details.name ?? '').trim();
  }

  return nextData;
}

export async function GET(_request, { params }) {
  const { objectId } = await params;
  const result = await getAuthorizedAmenity(objectId);
  if (result.error) return result.error;

  return json(200, { object: result.object });
}

export async function PATCH(request, { params }) {
  const { objectId } = await params;
  const body = await request.json().catch(() => ({}));
  const { villageId, details } = body || {};

  if (!villageId || !details || typeof details !== 'object') {
    return json(400, { error: 'Village and amenity details are required.' });
  }

  const result = await getAuthorizedAmenity(objectId, villageId);
  if (result.error) return result.error;

  const objectData = buildAmenityData(result.object.object_data || {}, details);
  const { data: savedObject, error: updateError } = await result.admin
    .from('blueprint_objects')
    .update({
      object_data: objectData,
      updated_at: new Date().toISOString()
    })
    .eq('id', objectId)
    .eq('village_id', villageId)
    .select('*')
    .single();

  if (updateError || !savedObject) {
    return json(400, { error: updateError?.message || 'Amenity details could not be saved.' });
  }

  return json(200, { object: savedObject });
}
