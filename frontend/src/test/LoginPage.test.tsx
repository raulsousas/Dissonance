import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import LoginPage from '@/pages/LoginPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    // Simulate unauthenticated API response
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 401 })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the Dissonance heading', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByText('Dissonance')).toBeInTheDocument()
  })

  it('renders the Google SSO link pointing to the backend', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    const link = screen.getByRole('link', { name: /continue with google/i })
    expect(link).toBeInTheDocument()
    // The link must point directly to the backend (absolute URL) so the
    // browser follows the OAuth redirect without going through the Vite proxy.
    expect(link.getAttribute('href')).toMatch(/\/auth\/google$/)
  })

  it('renders the invitation-only notice', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByText(/invitation-only/i)).toBeInTheDocument()
  })

  it('shows unauthorized error when error query param is present', () => {
    // Override window.location.search for this test
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?error=unauthorized' },
    })

    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByText(/not authorised to access/i)).toBeInTheDocument()

    // Reset
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '' },
    })
  })
})
