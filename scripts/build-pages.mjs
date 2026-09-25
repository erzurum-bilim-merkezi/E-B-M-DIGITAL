#!/usr/bin/env node
// Builds the site exactly like the GitHub Pages deploy: `vite build` + the SPA fallback
// (index.html copied to 404.html so deep links boot the app).
//   node scripts/build-pages.mjs [--mode e2e] [--outDir dist-e2e]
// BASE_PATH / VITE_* come from the environment (see .github/workflows/deploy.yml).
import { spawnSync } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const outIndex = args.indexOf('--outDir')
const outDir = outIndex >= 0 ? (args[outIndex + 1] ?? 'dist') : 'dist'

// Run Vite's CLI with this Node binary: no shell, so arguments are passed as-is on every OS.
const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const result = spawnSync(process.execPath, [viteCli, 'build', ...args], {
  stdio: 'inherit',
  env: process.env,
})
if (result.status !== 0) process.exit(result.status ?? 1)

copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))
console.log(`✔ ${outDir}/404.html (SPA fallback)`)
