import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import { ToastContainer } from '@/components/ui/ToastContainer'
import LoginPage from '@/pages/LoginPage'
import AppLayout from '@/components/layout/AppLayout'
import ChannelPage from '@/pages/ChannelPage'
import DmPage from '@/pages/DmPage'
import WelcomePage from '@/pages/WelcomePage'
import InvitePage from '@/pages/InvitePage'
import AdminPage from '@/pages/AdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/:code" element={<InvitePage />} />

          {/* Protected — all /app routes require authentication */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<WelcomePage />} />
            <Route path="servers/:serverId" element={<WelcomePage />} />
            <Route path="servers/:serverId/channels/:channelId" element={<ChannelPage />} />
            <Route path="dm" element={<DmPage />} />
            <Route path="dm/:conversationId" element={<DmPage />} />
          </Route>

          {/* Admin — requires admin role */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  )
}
