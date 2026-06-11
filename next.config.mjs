/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHostname = '';

try {
  supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : '';
} catch {
  supabaseHostname = '';
}

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com'
      },
      ...(supabaseHostname ? [{
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**'
      }] : [])
    ]
  }
};

export default nextConfig;
