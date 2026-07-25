import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import Ventas from './pages/Ventas'
import Devoluciones from './pages/Devoluciones'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/devoluciones" element={<Devoluciones />} />
            <Route path="/" element={<Navigate to="/ventas" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
