import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from "@/contexts/auth-context"
import MainLayout from "@/components/layout/main-layout"
import Login from "@/pages/login"
import LandingPage from "@/pages/landing"
import Browse from "@/pages/browse"
import Entry from "@/pages/entry"
import ContributeExperience from "@/pages/contribute"
import { ProtectedRoute } from '@/components/protected-route';
import UserEntries from "@/pages/user-entries";

const apiUrl = import.meta.env.VITE_BACKEND_API_URL;
console.log('DEBUG - Environment variables:', {
    all: import.meta.env,
    vite: import.meta.env.VITE_BACKEND_API_URL,
    regular: import.meta.env.VITE_BACKEND_API_URL
});

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <MainLayout>
                <Login />
              </MainLayout>
            }
          />
          <Route
            path="/browse"
            element={
              <MainLayout>
                <Browse />
              </MainLayout>
            }
          />
          <Route
            path="/entry/:experienceId"
            element={
              <MainLayout>
                <Entry />
              </MainLayout>
            }
          />
          <Route
            path="/"
            element={
              <MainLayout>
                <LandingPage />
              </MainLayout>
            }
          />
          {/* Handle LinkedIn OAuth callback */}
          <Route
            path="/api/auth/linkedin/callback"
            element={
              <MainLayout>
                <Login />
              </MainLayout>
            }
          />
          {/* Protected routes */}
          <Route
            path="/contribute"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ContributeExperience />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-entries"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <UserEntries />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App