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
    // מדיניות אבטחה: הכלי לא יכול לטעון קוד או לשלוח מידע לשום כתובת חוץ מהאתר עצמו
    !proto && {
      name: 'csp',
      apply: 'build' as const,
      transformIndexHtml: (html: string) =>
        html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'" />\n    <meta name="referrer" content="no-referrer" />`,
        ),
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
        background_color: '#F6F8FD',
        theme_color: '#4566E8',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
})
