import { useAuth } from '../context/AuthContext'

// Barra superior reutilizable en cada página.
// `title` va a la izquierda, `stats` es contenido opcional (chips, botones)
// que se muestra antes del bloque fijo de vendedor + cerrar sesión.
export default function Header({ title, stats, children }) {
  const { usuario, logout } = useAuth()

  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {children}
      </div>

      <div className="flex items-center gap-6">
        {stats}
        <span className="text-sm text-white/50">{usuario?.email}</span>
        <button
          onClick={logout}
          className="text-sm font-semibold text-red-400 transition hover:text-red-300"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
