import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import { isMockBackend } from '@/shared/config/backend'
import { env } from '@/shared/config/env'
import { readStorage, writeStorage } from '@/shared/lib/storage'

import '@/app/styles/global.css'

const CHUNK_RELOAD_KEY = 'kasif:chunk-reload'

// After a deploy, a tab opened earlier may ask for route chunks that no longer exist: reload once
// to pick up the new build (guarded against loops — then the route error page takes over).
window.addEventListener('vite:preloadError', (event) => {
  const last = Number(readStorage(CHUNK_RELOAD_KEY, 'session') ?? '0')
  if (Date.now() - last < 30_000) return
  writeStorage(CHUNK_RELOAD_KEY, String(Date.now()), 'session')
  event.preventDefault()
  window.location.reload()
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')
const root = rootElement

/** Mock backend: seed demo/E2E data before the first render (its own chunk; never in coming-soon). */
async function prepareBackend() {
  if (env.VITE_COMING_SOON || !isMockBackend) return
  try {
    const { bootstrapMockBackend } = await import('@/app/mock/bootstrap')
    await bootstrapMockBackend()
  } catch (error) {
    console.error('Deneme verisi hazırlanamadı', error)
  }
}

void prepareBackend().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
