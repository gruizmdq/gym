import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { markSignInOffered, SIGN_IN_OFFERED_KEY } from '../features/account/SignInPage'
import { supabase } from '../sync/client'
import { useAccount } from '../sync/status'
import { TabBar } from '../ui/TabBar'

function alreadyOffered(): boolean {
  try {
    return localStorage.getItem(SIGN_IN_OFFERED_KEY) === '1'
  } catch {
    return true
  }
}

export function AppShell() {
  const navigate = useNavigate()
  const { loading, email } = useAccount()

  // Sign-in is offered only once; after that it lives in Settings.
  useEffect(() => {
    if (!supabase || loading || email || alreadyOffered()) return
    markSignInOffered()
    navigate('/sign-in')
  }, [loading, email, navigate])

  return (
    <div className="flex h-dvh flex-col">
      {/* The scroll covers the whole window; the content keeps to the app's column. */}
      <main className="flex-1 overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] pb-32">
        <div className="mx-auto max-w-app px-4">
          <Outlet />
        </div>
      </main>
      <TabBar />
    </div>
  )
}
