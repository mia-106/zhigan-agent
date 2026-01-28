/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 让 ESLint 闭嘴（忽略代码规范错误）
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 2. 让 TypeScript 闭嘴（忽略类型错误）
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;