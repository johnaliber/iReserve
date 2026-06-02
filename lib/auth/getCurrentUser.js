import { createClient } from '../supabase/server';

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return { ...user, profile: null };
    }

    return {
      ...user,
      profile,
    };
  } catch (error) {
    console.error('Unexpected error fetching current user:', error);
    return null;
  }
}
