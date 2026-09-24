#!/usr/bin/env node
// A static server that behaves like GitHub Pages, for E2E tests:
//   • the site lives under BASE_PATH (default /E-B-M-DIGITAL/); `/E-B-M-DIGITAL` → 301 to the slash;
//   • no SPA rewrites — an unknown path is answered with 404.html and status 404 (the deploy
//     workflow copies index.html to 404.html, so deep links still boot the app);
//   • no custom headers (Pages can't send CSP/HSTS — the app ships its CSP as <meta>).
// Usage: node scripts/pages-server.mjs [dir=dist] ; env PORT (4173), BASE_PATH.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'

const root = path.resolve(process.argv[2] ?? 'dist')
const base = process.env.BASE_PATH ?? '/E-B-M-DIGITAL/'
const port = Number(process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
}

async function fileAt(relative) {
  const target = path.resolve(root, relative)
  if (target !== root && !target.startsWith(root + path.sep)) return null // path traversal
  try {
    const info = await stat(target)
    if (info.isDirectory()) return fileAt(path.join(relative, 'index.html'))
    return { target, size: info.size }
  } catch {
    return null
  }
}

function send(res, status, file, method) {
  const type = TYPES[path.extname(file.target).toLowerCase()] ?? 'application/octet-stream'
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': file.size,
    // Pages: short-lived caching for everything.
    'Cache-Control': 'max-age=600',
  })
  if (method === 'HEAD') return res.end()
  createReadStream(file.target).pipe(res)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`)
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400).end('Bad Request')
    return
  }

  if (`${pathname}/` === base) {
    res.writeHead(301, { Location: `${base}${url.search}` }).end()
    return
  }
  if (!pathname.startsWith(base)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — not this site')
    return
  }

  const relative = pathname.slice(base.length) || 'index.html'
  const file = await fileAt(relative)
  if (file) {
    send(res, 200, file, req.method)
    return
  }
  const fallback = await fileAt('404.html')
  if (fallback) send(res, 404, fallback, req.method)
  else res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404')
})

server.listen(port, () => {
  console.log(`Pages-like server: http://localhost:${port}${base} → ${root}`)
})
