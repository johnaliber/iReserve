import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export const updateSession = async (request) => {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  if (user) {
    // If logged in, fetch user role from profile to handle route security
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'customer';

    // Role-based path guards
    if (path.startsWith('/super-admin') && role !== 'super_admin') {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    if (path.startsWith('/village-admin') && role !== 'village_admin' && role !== 'super_admin') {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    if (path.startsWith('/accounting') && role !== 'accounting' && role !== 'super_admin') {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    if (path.startsWith('/architect') && role !== 'architect' && role !== 'super_admin') {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    if (path.startsWith('/customer') && role !== 'customer' && role !== 'super_admin') {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // Authenticated users should be redirected from auth forms directly to dashboards
    if (path.startsWith('/auth/')) {
      if (role === 'super_admin') url.pathname = '/super-admin/dashboard';
      else if (role === 'village_admin') url.pathname = '/village-admin/dashboard';
      else if (role === 'accounting') url.pathname = '/accounting/dashboard';
      else if (role === 'architect') url.pathname = '/architect/dashboard';
      else url.pathname = '/customer/dashboard';
      return NextResponse.redirect(url);
    }
  } else {
    // Non-authenticated users redirecting to login when accessing restricted panels
    if (
      path.startsWith('/super-admin') ||
      path.startsWith('/village-admin') ||
      path.startsWith('/accounting') ||
      path.startsWith('/architect') ||
      path.startsWith('/customer')
    ) {
      url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }
  }

  return response;
};
