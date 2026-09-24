/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { parseEnv } from './src/shared/config/env.schema.ts'

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

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Fail the build (not the user's browser) when configuration is invalid.
  const appEnv = parseEnv(loadEnv(mode, process.cwd(), 'VITE_'))

  return {
    base: resolveBasePath(),
    plugins: [
      react(),
      tailwindcss(),
      comingSoonDocument(appEnv.VITE_COMING_SOON),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: appEnv.VITE_APP_NAME,
          short_name: 'EBM',
          lang: 'tr',
          theme_color: '#0a1733',
          background_color: '#0a1733',
          display: 'standalone',
          icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
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
        reporter: ['text', 'html', 'lcov'],
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
