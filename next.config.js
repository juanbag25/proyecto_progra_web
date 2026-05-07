/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/presentacion',
        destination: '/presentacion.html',
      },
    ];
  },
};

module.exports = nextConfig;
