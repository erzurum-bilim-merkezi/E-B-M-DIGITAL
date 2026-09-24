#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): formats the file Claude just wrote so its
// diffs always match Prettier. Reads the tool call as JSON on stdin.
// Never blocks the edit — errors are reported on stderr and the hook exits 0.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const FORMATTABLE = /\.(?:[cm]?[jt]sx?|json|css|md|html|ya?ml)$/i

try {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk

  const payload = JSON.parse(raw || '{}')
  const filePath = payload.tool_input?.file_path ?? payload.tool_response?.filePath
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()

  const insideProject =
    typeof filePath === 'string' &&
    !path.relative(projectDir, path.resolve(filePath)).startsWith('..') &&
    !path.isAbsolute(path.relative(projectDir, path.resolve(filePath)))

  const shouldFormat =
    insideProject &&
    FORMATTABLE.test(filePath) &&
    !filePath.includes('node_modules') &&
    existsSync(filePath)

  if (shouldFormat) {
    const require = createRequire(path.join(projectDir, 'package.json'))
    const prettierBin = path.join(
      path.dirname(require.resolve('prettier/package.json')),
      'bin',
      'prettier.cjs',
    )
    // --ignore-unknown + .prettierignore (resolved from cwd) keep generated files untouched.
    execFileSync(
      process.execPath,
      [prettierBin, '--write', '--ignore-unknown', '--log-level', 'warn', filePath],
      { cwd: projectDir, stdio: ['ignore', 'ignore', 'inherit'] },
    )
  }
} catch (error) {
  console.error(`[format-on-edit] skipped: ${error instanceof Error ? error.message : error}`)
}
