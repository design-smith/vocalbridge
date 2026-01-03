import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/auth/context'
import { ToastProvider } from '@/components/ToastContext'
import { ProtectedRoute } from '@/auth/guard'
import { AppShell } from '@/components/AppShell'
import { Login } from '@/pages/Login'
import { Agents } from '@/pages/Agents'
import { TryIt } from '@/pages/TryIt'
import { Usage } from '@/pages/Usage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/agents"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Agents />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/try"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <TryIt />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/usage"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Usage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/agents" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
