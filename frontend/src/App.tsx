import { lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import AppShell from './components/layout/AppShell'

const Home = lazy(() => import('./pages/Home'))
const Users = lazy(() => import('./pages/Users'))
const Tickets = lazy(() => import('./pages/Tickets'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const Resources = lazy(() => import('./pages/Resources'))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="resources" element={<Resources />} />
          <Route
            path="users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
