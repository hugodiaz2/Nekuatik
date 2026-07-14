import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Cargando...
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  return children
}
