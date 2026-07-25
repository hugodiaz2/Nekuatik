import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `block px-4 py-2 text-sm rounded-md transition ${
    isActive
      ? 'bg-white text-black font-bold'
      : 'text-gray-300 hover:bg-gray-800'
  }`

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3e3d3] text-base">
          🍬
        </span>
        <span className="text-lg font-bold tracking-wide text-white">
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
