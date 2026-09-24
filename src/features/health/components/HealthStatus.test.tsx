import { http, HttpResponse } from 'msw'

import { buildUrl } from '@/shared/api/http-client'
import { server } from '@/test/mocks/server'
import { renderWithProviders, screen } from '@/test/test-utils'

import { HealthStatus } from './HealthStatus'

const healthUrl = buildUrl('/health').href

describe('HealthStatus', () => {
  it('shows a loading state, then the API status and version', async () => {
    renderWithProviders(<HealthStatus />)

    expect(screen.getByRole('status')).toHaveTextContent(/kontrol ediliyor/i)
    expect(await screen.findByText(/API: Çalışıyor/)).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
  })

  it('shows the degraded state reported by the API', async () => {
    server.use(http.get(healthUrl, () => HttpResponse.json({ status: 'degraded' })))

    renderWithProviders(<HealthStatus />)

    expect(await screen.findByText(/API: Kısmi kesinti/)).toBeInTheDocument()
  })

  it('shows unreachable when the request fails and recovers on refresh', async () => {
    server.use(http.get(healthUrl, () => HttpResponse.json(null, { status: 503 }), { once: true }))

    const { user } = renderWithProviders(<HealthStatus />)

    expect(await screen.findByText(/API: Erişilemiyor/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Yenile' }))

    expect(await screen.findByText(/API: Çalışıyor/)).toBeInTheDocument()
  })
})
