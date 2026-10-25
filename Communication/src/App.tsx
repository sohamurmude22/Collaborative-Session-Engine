import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider } from './context/index.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { Layout } from './components/Layout.js';
import { Home } from './pages/Home.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Dashboard } from './pages/Dashboard.js';
import { InterviewerDashboard } from './pages/InterviewerDashboard.js';
import { CandidateDashboard } from './pages/CandidateDashboard.js';
import { SessionReplay } from './pages/SessionReplay.js';
import { AdminDashboard } from './pages/AdminDashboard.js';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Public Routes */}
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="sessions/:id" element={<CandidateDashboard />} />
              <Route path="sessions/:id/candidate" element={<CandidateDashboard />} />
              <Route path="sessions/:id/editor" element={<CandidateDashboard />} />
              <Route path="sessions/:id/interviewer" element={<InterviewerDashboard />} />
              <Route path="sessions/:id/activity" element={<InterviewerDashboard />} />
              <Route path="sessions/:id/replay" element={<SessionReplay />} />
            </Route>

            {/* System Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="admin" element={<AdminDashboard />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  </ThemeProvider>
  );
}

export default App;
