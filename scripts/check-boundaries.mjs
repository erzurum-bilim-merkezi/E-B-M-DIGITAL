#!/usr/bin/env node
// Enforces the layer rules from docs/ARCHITECTURE.md:
//   app → pages → features → shared   (imports only point "downwards")
//   features/pages use another feature only through its public API ('@/features/<name>')
// Exits 1 and lists every violation.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('src')
const LAYERS = ['shared', 'features', 'pages', 'app'] // lowest → highest
const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) yield full
  }
}

/** '@/features/x/api/y' or a relative path → ['features', 'x', 'api', 'y'] relative to src. */
function toSrcSegments(specifier, fromFile) {
  let absolute
  if (specifier.startsWith('@/')) absolute = path.join(SRC, specifier.slice(2))
  else if (specifier.startsWith('.')) absolute = path.resolve(path.dirname(fromFile), specifier)
  else return null // package import
  const relative = path.relative(SRC, absolute)
  return relative.startsWith('..') ? null : relative.split(path.sep)
}

const violations = []

for (const file of walk(SRC)) {
  const from = path.relative(SRC, file).split(path.sep)
  const fromLayer = from[0]
  if (!LAYERS.includes(fromLayer)) continue // src/test, src/main.tsx, etc.

  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2]
    const to = toSrcSegments(specifier, file)
    if (!to || !LAYERS.includes(to[0])) continue

    const [toLayer, toSlice, ...rest] = to
    const where = `${path.relative(process.cwd(), file)} → '${specifier}'`

    if (LAYERS.indexOf(toLayer) > LAYERS.indexOf(fromLayer)) {
      violations.push(`${where}\n    '${fromLayer}' must not depend on higher layer '${toLayer}'`)
      continue
    }

    const crossesFeature =
      toLayer === 'features' && !(fromLayer === 'features' && from[1] === toSlice)
    if (crossesFeature && rest.length > 0 && !(rest.length === 1 && rest[0] === 'index')) {
      violations.push(
        `${where}\n    import other features via their public API: '@/features/${toSlice}'`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error(`✖ ${violations.length} architecture boundary violation(s):\n`)
  for (const v of violations) console.error(`  ${v}\n`)
  process.exit(1)
}

console.log('✔ Architecture boundaries OK')
