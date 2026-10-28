import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import FriendsPage from '@/pages/FriendsPage'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/app/dm']}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('FriendsPage', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                id: 'user-1',
                email: 'user@example.com',
                displayName: 'Test User',
                avatarUrl: null,
                status: 'online',
                role: 'user',
                token: 'mock-token',
              },
            }),
            { status: 200 }
          )
        )
      }

      if (url.includes('/api/friends/requests')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                incoming: [],
                outgoing: [],
              },
            }),
            { status: 200 }
          )
        )
      }

      if (url.includes('/api/friends')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: 'friend-1',
                  email: 'alice@example.com',
                  displayName: 'Alice',
                  avatarUrl: null,
                  status: 'online',
                  friendshipId: 'f-1',
                  since: '2026-01-01T00:00:00Z',
                },
              ],
            }),
            { status: 200 }
          )
        )
      }

      return Promise.resolve(new Response(null, { status: 404 }))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Friends header and navigation tabs', async () => {
    render(<FriendsPage />, { wrapper: Wrapper })
    expect(screen.getByText('Amigos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disponível/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pendente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar amigo/i })).toBeInTheDocument()
  })
})
