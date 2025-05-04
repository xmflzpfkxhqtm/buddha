/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ekqucunjkiimfisgiyfp.supabase.co',
        pathname: '/storage/v1/object/public/**', // 모든 버킷 하위 경로
      },
    ],
    // 또는 프로젝트 전역에서 원본 사이즈 그대로 쓰려면 → unoptimized: true
  },
};



module.exports = nextConfig;
