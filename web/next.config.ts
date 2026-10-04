import path from 'node:path';
import type { NextConfig } from 'next';

// The account protocol core lives in ../src/service and is shared with the desktop app.
const repositoryRoot = path.join(__dirname, '..');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const config: NextConfig = {
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot,
  poweredByHeader: false,
  async headers() { return [{ source: '/:path*', headers: securityHeaders }]; },
};

export default config;
