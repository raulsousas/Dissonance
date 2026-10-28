import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Login page — shown to unauthenticated users.
 * The only login method is Google SSO (OAuth 2.0).
 */
export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  // If already authenticated, redirect to app
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/app', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  const errorParam = new URLSearchParams(window.location.search).get('error')

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div
        className="w-full max-w-sm mx-4 p-8 rounded-lg shadow-xl"
        style={{ background: 'var(--color-bg-tertiary)' }}
      >
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Guilda
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Private communication for your guild
          </p>
        </div>

        {/* Error message */}
        {errorParam && (
          <div
            className="mb-4 px-4 py-3 rounded text-sm"
            style={{
              background: 'rgba(242,63,66,0.15)',
              color: 'var(--color-danger)',
              border: '1px solid var(--color-danger)',
            }}
            role="alert"
          >
            {errorParam === 'unauthorized'
              ? 'Your account is not authorised to access Guilda. Contact an admin for an invite.'
              : 'Something went wrong during sign in. Please try again.'}
          </div>
        )}

        {/* Google SSO button */}
        <a
          href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/auth/google`}
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-md font-medium text-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2"
          style={{
            background: '#ffffff',
            color: '#3c4043',
          }}
          aria-label="Continue with Google"
        >
          <GoogleIcon />
          Continue with Google
        </a>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Access is invitation-only. You must have an existing invite or be approved by an admin.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  )
}
