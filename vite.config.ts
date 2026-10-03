import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'development-csp',
    transformIndexHtml(html, context) {
      // Vite injects a React refresh preamble in development; production stays restrictive.
      return context.server ? html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'") : html;
    },
  }],
  base: './', server: { port: 5173, strictPort: true }, build: { outDir: 'dist', rolldownOptions: { input: { main: 'index.html', tracker: 'tracker.html' } } },
});
