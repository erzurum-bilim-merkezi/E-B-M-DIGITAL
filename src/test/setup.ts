import '@testing-library/jest-dom/vitest'
// IndexedDB for the mock media store (idb-keyval) and editor backups.
import 'fake-indexeddb/auto'

import { configure } from '@testing-library/react'

import { server } from './mocks/server'

// Whole-page renders (route tree + seeded mock backend) can take >1 s on a busy CI machine.
configure({ asyncUtilTimeout: 5_000 })

// jsdom does not implement scrolling; React Router's <ScrollRestoration> calls it.
window.scrollTo = () => {}

// Any request without a handler fails the test — no accidental real network calls.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
