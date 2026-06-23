/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'http://localhost:5050/api'
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5050/api/:path*'
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:5050/socket.io/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
