import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

const proto = process.env.VITE_PROTO === '1'

export default defineConfig({
  base: './',
  build: proto ? { outDir: 'dist-proto', assetsInlineLimit: 100_000_000 } : undefined,
  plugins: [
    react(),
    proto && viteSingleFile(),
    proto && {
      name: 'proto-html',
      transformIndexHtml: (html: string) => html.replace(', viewport-fit=cover', '').replace(/<link rel="icon"[^>]*>/, ''),
    },
    !proto && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,mjs}'], maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },
      manifest: {
        name: 'דיווח חודשי למשרד הביטחון',
        short_name: 'דיווח חודשי',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        display: 'standalone',
        background_color: '#F4F5F7',
        theme_color: '#1F3A5F',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
})
