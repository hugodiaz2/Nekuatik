import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `block rounded-lg px-4 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
      : 'text-white/60 hover:bg-white/5 hover:text-white'
  }`

export default function Sidebar() {
  return (
    <aside className="relative z-10 flex h-screen w-56 shrink-0 flex-col border-r border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-base shadow-lg shadow-orange-500/30">
          🍬
        </span>
        <span className="bg-gradient-to-r from-orange-300 via-amber-200 to-orange-300 bg-clip-text text-lg font-bold tracking-wide text-transparent">
          NEKUATIK
        </span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        <NavLink to="/ventas" className={linkClass}>
          Home
        </NavLink>
        <NavLink to="/inventario" className={linkClass}>
          Inventario
        </NavLink>
        <NavLink to="/devoluciones" className={linkClass}>
          Devoluciones
        </NavLink>
      </nav>
    </aside>
  )
}
