import '@testing-library/jest-dom/vitest'

import { server } from './mocks/server'

// jsdom does not implement scrolling; React Router's <ScrollRestoration> calls it.
window.scrollTo = () => {}

// Any request without a handler fails the test — no accidental real network calls.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
