/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { buildCsp, REFERRER_POLICY } from './src/shared/config/csp.ts'
import { findSecretLikeKeys, parseEnv, secretLeakMessage } from './src/shared/config/env.schema.ts'

/** Public path the app is served from, e.g. `/E-B-M-DIGITAL/` on GitHub Pages. */
function resolveBasePath() {
  const base = process.env['BASE_PATH'] || '/'
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error(`BASE_PATH must start and end with "/" (got "${base}")`)
  }
  return base
}

/**
 * Coming-soon mode renders a dark, night-sky page. Put the dark theme (and the page's
 * night canvas) on <html> at build time so the first paint is already dark — no white flash.
 */
function comingSoonDocument(enabled: boolean): Plugin {
  return {
    name: 'ebm:coming-soon-document',
    transformIndexHtml: (html) =>
      enabled
        ? html.replace(
            '<html lang="tr">',
            '<html lang="tr" data-theme="dark" style="--canvas: var(--color-night-900)">',
          )
        : html,
  }
}

/**
 * GitHub Pages cannot send headers, so every build carries its CSP as a <meta> right after the
 * charset (before any script or stylesheet). The dev server stays unrestricted (HMR, devtools).
 */
function contentSecurityPolicy(backendOrigin: string | null): Plugin {
  const tags = [
    // Same source and inputs as the nginx header (scripts/generate-nginx-headers.mjs).
    `<meta http-equiv="Content-Security-Policy" content="${buildCsp({ backendOrigin })}" />`,
    `<meta name="referrer" content="${REFERRER_POLICY}" />`,
  ]
  return {
    name: 'kasif:csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => {
        const charset = /<meta charset="UTF-8" \/>/i
        if (!charset.test(html)) throw new Error('index.html must start <head> with <meta charset>')
        return html.replace(charset, (match) => [match, ...tags].join('\n    '))
      },
    },
  }
}

/**
 * `<audio>` asks for byte ranges, and a 206 answer is never cached, so narration would not play
 * offline. For CORS-mode audio (the kids' player) fetch the whole file, let the cache keep it and
 * cut the asked range out of it; later plays come from the cache through `rangeRequests`. Video
 * keeps streaming ranges, and opaque (no-cors) audio is left alone: Chrome refuses a full opaque
 * answer to a range request. Serialized into the service worker: no outside references.
 */
const wholeAudioFile = {
  requestWillFetch: async ({ request }: { request: Request }) => {
    if (request.destination !== 'audio' || request.mode !== 'cors' || !request.headers.has('range'))
      return request
    const headers = new Headers(request.headers)
    headers.delete('range')
    return new Request(request, { headers })
  },
  handlerWillRespond: async ({ request, response }: { request: Request; response: Response }) => {
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range')?.trim() ?? '')
    if (!range || response.status !== 200 || request.destination !== 'audio') return response
    const body = await response.blob()
    const size = body.size
    const start = range[1] ? Number(range[1]) : Math.max(size - Number(range[2]), 0)
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    const headers = new Headers(response.headers)
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    headers.set('Content-Length', String(end - start + 1))
    return new Response(body.slice(start, end + 1), {
      status: 206,
      statusText: 'Partial Content',
      headers,
    })
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Fail the build (not the user's browser) when configuration is invalid.
  const rawEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const appEnv = parseEnv(rawEnv)

  // VITE_* values are public. CI (which builds the live site) refuses secret-looking ones;
  // locally we warn loudly — env.ts reads known keys only, so they never reach the bundle.
  const leakedKeys = findSecretLikeKeys(rawEnv)
  if (leakedKeys.length > 0) {
    if (process.env['CI']) throw new Error(secretLeakMessage(leakedKeys))
    console.warn(`\n⚠  ${secretLeakMessage(leakedKeys)}\n`)
  }

  return {
    base: resolveBasePath(),
    plugins: [
      react(),
      tailwindcss(),
      comingSoonDocument(appEnv.VITE_COMING_SOON),
      // The Supabase project is the only backend origin (CSP_BACKEND_ORIGIN overrides it).
      contentSecurityPolicy(
        process.env['CSP_BACKEND_ORIGIN'] ||
          (appEnv.VITE_BACKEND === 'supabase' && appEnv.VITE_SUPABASE_URL
            ? new URL(appEnv.VITE_SUPABASE_URL).origin
            : null),
      ),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'kasifkit-logo-mark.svg'],
        workbox: {
          cacheId: 'kasif',
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          // Supabase Storage (plan §3.6): kits keep working when the centre's Wi-Fi drops.
          runtimeCaching: [
            {
              // catalog.json, qr-index.json, latest.json change on every publish.
              urlPattern: ({ url }) =>
                url.pathname.includes('/storage/v1/object/public/published/') &&
                !/\/v\d+\.json$/.test(url.pathname),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'kasif-published-index',
                networkTimeoutSeconds: 4,
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // v<n>.json never changes once written.
              urlPattern: ({ url }) =>
                url.pathname.includes('/storage/v1/object/public/published/') &&
                /\/v\d+\.json$/.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'kasif-published-versions',
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 200 },
              },
            },
            {
              // Library files and AI drawings have their own id in the name: they never change.
              // Kids' <img>/<audio> load them in CORS mode, so the responses are cacheable.
              urlPattern: ({ url }) =>
                url.pathname.includes('/storage/v1/object/public/media/') ||
                url.pathname.includes('/storage/v1/object/public/ai/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'kasif-media',
                cacheableResponse: { statuses: [200] },
                // Audio asks for byte ranges: a cached file answers them too.
                rangeRequests: true,
                plugins: [wholeAudioFile],
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              },
            },
          ],
        },
        // Pre-launch the installable app is the coming-soon page; afterwards it is Kâşif.
        manifest: appEnv.VITE_COMING_SOON
          ? {
              name: appEnv.VITE_APP_NAME,
              short_name: 'EBM',
              lang: 'tr',
              theme_color: '#0a1733',
              background_color: '#0a1733',
              display: 'standalone',
              icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
            }
          : {
              name: `Kâşif · ${appEnv.VITE_APP_NAME}`,
              short_name: 'Kâşif',
              description:
                'Bilim merkezindeki deney kitlerinin QR kodlarını okut, etkileşimli kartlarla keşfet, rozet topla.',
              lang: 'tr',
              dir: 'ltr',
              start_url: '.',
              scope: '.',
              display: 'standalone',
              orientation: 'any',
              theme_color: '#4f46e5',
              background_color: '#eef4ff',
              categories: ['education', 'kids'],
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
      strictPort: true,
    },
    build: {
      // Generated for error-tracking upload, but not referenced from the shipped bundle.
      sourcemap: 'hidden',
      target: 'es2023',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Supabase adapters are unit-tested against MSW at the local-stack address (never the live
      // project). VITE_BACKEND stays "mock": the app under test runs on the mock backend.
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit-tests-only-000000',
      },
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      css: true,
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov', 'json-summary'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/test/**',
          'src/**/*.d.ts',
          // Composition roots — covered by e2e tests
          'src/main.tsx',
          'src/app/App.tsx',
        ],
        thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
      },
    },
  }
})
