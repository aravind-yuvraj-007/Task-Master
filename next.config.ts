import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // Recommended for smoother development experience with cloud IDEs / previews
    // Adjust the pattern if your preview URLs are different.
    // Using a very broad pattern here for general development.
    // For production, you might want to be more specific or remove it.
    allowedDevOrigins: ["*.cloudworkstations.dev", "*.gitpod.io", "*.github.dev", "*.googleusercontent.com"],
  },
};

export default nextConfig;
