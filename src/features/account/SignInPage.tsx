import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { signIn } from '../../sync/start'
import { button } from '../../ui/buttons'

export const SIGN_IN_OFFERED_KEY = 'gym.signInOffered'

export function markSignInOffered(): void {
  try {
    localStorage.setItem(SIGN_IN_OFFERED_KEY, '1')
  } catch {
    // Without storage available, at worst it gets offered again.
  }
}

export function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSigningIn(true)
    setError(null)
    const failure = await signIn(email.trim(), password)
    setSigningIn(false)
    if (failure) {
      setError(failure)
      return
    }
    markSignInOffered()
    navigate('/', { replace: true })
  }

  const notNow = () => {
    markSignInOffered()
    navigate(-1)
  }

  return (
    <div className="flex min-h-dvh flex-col gap-7 bg-surface px-6 pt-[calc(env(safe-area-inset-top)+64px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="flex flex-col items-start gap-[18px]">
        <div
          className="flex size-[76px] items-center justify-center rounded-[18px] bg-accent text-white"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            width={48}
            height={48}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-bold text-large-title tracking-[-.02em]">Gym</h1>
          <p className="text-body text-ink-2">
            Entrá una sola vez: la sesión queda guardada en este iPhone.
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-3.5" onSubmit={(e) => void submit(e)}>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-foot text-ink-3">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[52px] rounded-[14px] bg-surface-2 px-3.5 shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:bg-surface focus:shadow-[inset_0_0_0_2px_var(--color-accent)]"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-foot text-ink-3">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-[52px] rounded-[14px] bg-surface-2 px-3.5 shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:bg-surface focus:shadow-[inset_0_0_0_2px_var(--color-accent)]"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-[14px] bg-warn-soft px-3 py-2.5 text-sub text-warn">
            {error}
          </p>
        )}
        <button
          type="submit"
          className={`${button.primary} mt-1.5`}
          disabled={signingIn}
          aria-busy={signingIn}
        >
          {signingIn ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="text-foot text-ink-3">
        Sin cuenta también podés entrenar. Lo que registres queda en el teléfono y se respalda en la
        nube cuando entres.
      </p>
      <div className="flex-1" />
      <button type="button" className={button.ghost} onClick={notNow}>
        Ahora no
      </button>
    </div>
  )
}
