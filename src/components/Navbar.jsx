import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-pink-600 text-white' : 'text-gray-600 hover:bg-pink-100'
  }`

export default function Navbar() {
  const { logout, usuario } = useAuth()

  return (
    <nav className="flex items-center justify-between bg-white shadow px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-pink-600">🍬 Nekuatik</span>
        <NavLink to="/ventas" className={linkClass}>
          Punto de Venta
        </NavLink>
        <NavLink to="/catalogo" className={linkClass}>
          Catálogo
        </NavLink>
        <NavLink to="/inventario" className={linkClass}>
          Inventario
        </NavLink>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{usuario?.email}</span>
        <button
          onClick={logout}
          className="text-sm font-medium text-red-500 hover:text-red-700"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
