import { createAdminClient } from '@/lib/supabase/admin';
import { reconcileBlueprintPropertyLinks } from '@/lib/properties/reconcileBlueprintPropertyLinks';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const villageSlug = new URL(request.url).searchParams.get('villageSlug')?.trim();

  if (!villageSlug) {
    return Response.json({ error: 'Village slug is required.' }, { status: 400 });
  }

  try {
    const result = await reconcileBlueprintPropertyLinks(createAdminClient(), villageSlug);
    return Response.json(result);
  } catch (error) {
    console.error('Map property reconciliation failed:', error);
    return Response.json(
      { error: error.message || 'Map properties could not be synchronized.' },
      { status: 500 }
    );
  }
}
