import { Outlet } from 'react-router'
import { TabBar } from '../ui/TabBar'

export function AppShell() {
  return (
    <div className="flex h-dvh flex-col">
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 pt-[env(safe-area-inset-top)] pb-32">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
