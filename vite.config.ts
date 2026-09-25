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
function contentSecurityPolicy(): Plugin {
  const tags = [
    // Same source and inputs as the nginx header (scripts/generate-nginx-headers.mjs).
    `<meta http-equiv="Content-Security-Policy" content="${buildCsp({ backendOrigin: process.env['CSP_BACKEND_ORIGIN'] || null })}" />`,
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
      contentSecurityPolicy(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'kasifkit-logo-mark.svg'],
        workbox: {
          cacheId: 'kasif',
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
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
