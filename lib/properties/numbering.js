export function normalizeNumberPart(value) {
  return String(value || '').trim().replace(/^([PBL])/i, '').trim();
}

export function suggestVillageCode(name = '') {
  const words = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'IR';

  const code = words.length === 1
    ? words[0].slice(0, 3)
    : words.map((word) => word[0]).join('');

  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'IR';
}

export function normalizeVillageCode(value, fallbackName = '') {
  const normalized = String(value || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
  return normalized || suggestVillageCode(fallbackName);
}

export function generatePropertyCode({
  villageCode,
  phaseNumber,
  blockNumber,
  lotNumber
}) {
  const code = normalizeVillageCode(villageCode);
  const phase = normalizeNumberPart(phaseNumber);
  const block = normalizeNumberPart(blockNumber);
  const lot = normalizeNumberPart(lotNumber);

  if (!code || !phase || !block || !lot) return '';

  return `${code}-P${phase}-B${block}-L${lot}`.replace(/\s+/g, '');
}

export async function getNextLotNumber(supabase, {
  villageId,
  phaseNumber = '1',
  blockNumber,
  excludePropertyId = null
}) {
  const phase = normalizeNumberPart(phaseNumber);
  const block = normalizeNumberPart(blockNumber);

  if (!villageId || !phase || !block) return '';

  let query = supabase
    .from('properties')
    .select('id, lot_number')
    .eq('village_id', villageId)
    .eq('phase_number', phase)
    .eq('block_number', block);

  if (excludePropertyId) {
    query = query.neq('id', excludePropertyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const highest = (data || []).reduce((max, property) => {
    const lotValue = Number.parseInt(normalizeNumberPart(property.lot_number), 10);
    return Number.isFinite(lotValue) ? Math.max(max, lotValue) : max;
  }, 0);

  return String(highest + 1);
}
