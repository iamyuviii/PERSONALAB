import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node", "sharp"],
};
export default nextConfig;
