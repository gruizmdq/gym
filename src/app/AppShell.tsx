import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { CLAVE_OFRECIDO, marcarOfrecido } from '../features/cuenta/EntrarPage'
import { supabase } from '../sync/cliente'
import { useCuenta } from '../sync/estado'
import { TabBar } from '../ui/TabBar'

function yaOfrecido(): boolean {
  try {
    return localStorage.getItem(CLAVE_OFRECIDO) === '1'
  } catch {
    return true
  }
}

export function AppShell() {
  const navigate = useNavigate()
  const { cargando, email } = useCuenta()

  // El login se ofrece una sola vez; después queda en Ajustes.
  useEffect(() => {
    if (!supabase || cargando || email || yaOfrecido()) return
    marcarOfrecido()
    navigate('/entrar')
  }, [cargando, email, navigate])

  return (
    <div className="flex h-dvh flex-col">
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 pt-[env(safe-area-inset-top)] pb-32">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
