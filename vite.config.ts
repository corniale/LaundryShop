import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Build stamp. A buyer on the phone has to be able to read back which build
 * they are running, or a support call is guesswork. The commit is whatever
 * the CI runner or git can tell us, and 'local' when neither can.
 */
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as { version: string }
function commit(): string {
  const fromCI = process.env.GITHUB_SHA
  if (fromCI) return fromCI.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'local'
  }
}
const buildStamp = {
  version: pkg.version,
  commit: commit(),
  date: new Date().toISOString().slice(0, 10),
}

export default defineConfig({
  base: './',
  define: { __APP_BUILD__: JSON.stringify(buildStamp) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': an installed PWA is rarely closed, so a
      // silent update sits waiting for a relaunch that may not come for days
      // and the shop never knows it is on an old build. See src/app/UpdateBanner.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Laundry Shop OS',
        short_name: 'Laundry',
        description: 'Counter app for a laundry shop — offline, no subscription.',
        theme_color: '#0F172A',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          data: ['dexie', 'zod', 'date-fns'],
        },
      },
    },
  },
})
