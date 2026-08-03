import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="relative flex h-screen overflow-hidden bg-neutral-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-orange-500/10 blur-[100px]" />
        <div className="absolute -right-32 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-[100px]" />
      </div>

      <Sidebar />
      <div className="relative z-10 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
