import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Génération PDF: embarquer les binaires Chromium dans la fonction Vercel
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/admin/invoices/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/**/*": ["./node_modules/@sparticuz/chromium/bin/**"],
    "**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
