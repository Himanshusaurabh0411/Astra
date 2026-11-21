import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const environment = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(environment)) process.loadEnvFile?.(environment);

const upstream = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const google = "https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com";
const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const publicApi = [process.env.NEXT_PUBLIC_BACKEND_URL, process.env.NEXT_PUBLIC_WS_URL]
  .filter(Boolean).map((value) => new URL(value).origin).join(" ");
const policy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devEval} ${google} blob:`,
  `style-src 'self' 'unsafe-inline' ${google}`,
  `img-src 'self' data: blob: ${google}`,
  "font-src 'self' https://fonts.gstatic.com data:",
  `connect-src 'self' ws: wss: ${google} ${publicApi}`,
  "worker-src 'self' blob:",
  "frame-src https://*.google.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  experimental: { externalDir: true, outputFileTracingRoot: workspace, cpus: 2 },
  webpack(config) {
    config.module.rules.push({ test: /\.geojson$/i, type: "json" });
    return config;
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${upstream}/api/:path*` },
      { source: "/health", destination: `${upstream}/health` },
      { source: "/ws/live", destination: `${upstream}/ws/live` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: policy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
