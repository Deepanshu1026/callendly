/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'http://localhost:5050/api'
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5050';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
