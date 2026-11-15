import { createClient, isAuthApiError, type Session } from '@supabase/supabase-js'

// The Worker talks to Supabase as Gonza: his session travels encrypted inside the OAuth grant
// and RLS applies as in the app. No secret or service_role key anywhere.
export interface Props {
  userId: string
  accessToken: string
  refreshToken: string
  // When Supabase's access token expires, in seconds since 1970.
  expiresAt: number
}

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

function anonymous(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth })
}

export function asUser(env: Env, props: Props) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth,
    global: { headers: { Authorization: `Bearer ${props.accessToken}` } },
  })
}

function toProps(session: Session): Props {
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
  }
}

// null: the email or the password don't match. Throws when Supabase doesn't answer (paused,
// down): that isn't Gonza's doing.
export async function signIn(env: Env, email: string, password: string): Promise<Props | null> {
  const { data, error } = await anonymous(env).auth.signInWithPassword({ email, password })
  if (error) {
    if (isAuthApiError(error) && error.status === 400) return null
    throw error
  }
  return toProps(data.session)
}

// 'revoked': that session is gone for good (password changed, signed out everywhere).
export async function refresh(env: Env, refreshToken: string): Promise<Props | 'revoked'> {
  const { data, error } = await anonymous(env).auth.refreshSession({ refresh_token: refreshToken })
  if (error) {
    if (isAuthApiError(error) && error.status >= 400 && error.status < 500) return 'revoked'
    throw error
  }
  return data.session ? toProps(data.session) : 'revoked'
}
