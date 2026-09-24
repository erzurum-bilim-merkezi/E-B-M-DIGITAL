import { render, screen } from '@testing-library/react'

import { mockMatchMedia } from '@/test/match-media'

import { ComingSoonPage } from './ComingSoonPage'

describe('ComingSoonPage', () => {
  it('tells visitors the platform is under construction', () => {
    render(<ComingSoonPage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Çalışmalar devam ediyor')
    expect(screen.getByText('Yapım aşamasında')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent(/dijital platformunu hazırlıyoruz/)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(String(new Date().getFullYear()))
  })

  it('sets the document title', () => {
    render(<ComingSoonPage />)

    expect(document.title).toBe('Çalışmalar devam ediyor | Erzurum Bilim Merkezi')
  })

  it('keeps the illustration out of the accessibility tree', () => {
    const { container } = render(<ComingSoonPage />)

    const illustration = container.querySelector('svg')
    expect(illustration).toHaveAttribute('aria-hidden', 'true')
    expect(illustration).toHaveAttribute('focusable', 'false')
  })

  it('animates the orbit only when motion is allowed', () => {
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false })
    const { container, unmount } = render(<ComingSoonPage />)
    expect(container.querySelectorAll('animateMotion')).toHaveLength(2)
    unmount()

    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true })
    const reduced = render(<ComingSoonPage />)
    expect(reduced.container.querySelectorAll('animateMotion')).toHaveLength(0)
  })
})
