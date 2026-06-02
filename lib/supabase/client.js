import { createBrowserClient } from '@supabase/ssr';

// Fallback to mock values during static compile/build phase if environment variables are not supplied
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const createClient = () =>
  createBrowserClient(supabaseUrl, supabaseKey);
