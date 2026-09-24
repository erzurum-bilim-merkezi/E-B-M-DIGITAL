#!/usr/bin/env node
// Prints the CHANGELOG.md section for a version: `node scripts/release-notes.mjs 0.1.0`.
// Exits 1 when the version has no entry, so a release can't ship without notes.
import { readFileSync } from 'node:fs'

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/release-notes.mjs <version>')
  process.exit(1)
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const sections = changelog.split(/^## /m).slice(1)
const section = sections.find((s) => s.startsWith(`[${version}]`))

if (!section) {
  console.error(`CHANGELOG.md has no entry for ${version}`)
  process.exit(1)
}

// Drop the heading line ("[0.1.0] - 2026-09-24"); keep the body.
console.log(section.slice(section.indexOf('\n') + 1).trim())
