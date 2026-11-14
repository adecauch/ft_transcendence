import { defineConfig } from 'vite';

// Vite configuration for the Poker Transcendence frontend.
// Serves static assets from /public and bundles src/ with ES modules.
export default defineConfig({
  // Base public path when served in production
  base: './',

  // Dev server settings
  server: {
    port: 3000,
    open: true,
    // API calls go to the back-end (server/, `npm run server`): same origin
    // for the browser, so the session cookie just works
    proxy: {
      '/api': 'http://127.0.0.1:3100',
      '/ws': {
        target: 'ws://127.0.0.1:3100',
        ws: true,
      },
    },
  },

  // Build output settings
  build: {
    outDir: 'dist',
    sourcemap: true,
  },

  // Allow importing glsl shaders as strings if needed later
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr'],
});
