import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Firebase Auth (email/contraseña) habla con estos dominios desde el navegador
const firebaseAuth = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
].join(" ");

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' ${firebaseAuth};
  frame-src https://*.firebaseapp.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`;

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Las acciones de la app mandan unos pocos campos; 1MB (default) sobra
      bodySizeLimit: "100kb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader.replace(/\s{2,}/g, " ").trim() },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // El token del enlace público no debe filtrarse ni indexarse
        source: "/c/:token",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
