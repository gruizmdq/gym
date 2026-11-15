import {
  AuthorizationError,
  authorizationErrorRedirect,
  CimdFetchError,
  type ConsentDescription,
  type OAuthHelpers,
} from '@cloudflare/workers-oauth-provider'
import { signIn } from './supabase'

// The authorization page: Claude (or another MCP client) asks to connect and Gonza signs in
// with his Supabase email and password. Typing the password is the consent, every time: there
// is no session of ours to remember, so nothing here can be forged from another site. The
// request is parsed again from the URL on every POST; nothing trusted comes from the form.

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// Tokens from src/index.css (the "Sistema visual" sheet). This page lives outside the app.
const style = `
:root{--white:#fff;--surface:#fff;--surface-2:#f6f7f9;--line:#e2e4e9;--ink:#0e1015;--ink-2:#464c59;--ink-3:#646a79;--accent:#2450f0;--warn:#7a4e00;--warn-soft:#fff3cc;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;color:var(--ink);-webkit-text-size-adjust:100%}
*{box-sizing:border-box}
body{margin:0;background:var(--surface)}
main{max-width:440px;margin:0 auto;padding:calc(env(safe-area-inset-top) + 48px) 24px 24px;display:flex;flex-direction:column;gap:24px}
.logo{width:76px;height:76px;border-radius:18px;background:var(--accent);color:var(--white);display:flex;align-items:center;justify-content:center}
h1{margin:0;font-size:34px;line-height:41px;font-weight:700;letter-spacing:-.02em}
p{margin:0;font-size:17px;line-height:22px;color:var(--ink-2)}
.foot{font-size:13px;line-height:18px;color:var(--ink-3)}
form{display:flex;flex-direction:column;gap:14px}
label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--ink-3)}
input{height:52px;border:0;border-radius:14px;background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line);padding:0 14px;font:inherit;font-size:17px;color:var(--ink);outline:none}
input:focus{background:var(--surface);box-shadow:inset 0 0 0 2px var(--accent)}
.error{border-radius:14px;background:var(--warn-soft);color:var(--warn);padding:10px 12px;font-size:15px;line-height:20px}
button{height:56px;border:0;border-radius:16px;font:inherit;font-size:17px;font-weight:600;cursor:pointer}
.primary{background:var(--accent);color:var(--white);margin-top:6px}
.ghost{height:48px;background:transparent;color:var(--accent)}
`

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

function html(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title><style>${style}</style></head><body><main>${body}</main></body></html>`,
    { status, headers },
  )
}

const logo = `<div class="logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg></div>`

function signInPage(
  details: ConsentDescription,
  form: { email?: string; error?: string } = {},
  status = 200,
): Response {
  const client = escapeHtml(details.clientName)
  const origin = details.clientDomain
    ? `La conexión la pide ${escapeHtml(details.clientDomain)}.`
    : 'El nombre lo declara la app y no está verificado.'
  const loopback = details.redirectIsLoopback
    ? '<p class="error">El acceso va a una app de esta computadora. Seguí solo si recién empezaste a conectarla vos.</p>'
    : ''
  return html(
    'Conectar Gym',
    `${logo}
<div style="display:flex;flex-direction:column;gap:6px">
  <h1>Conectar ${client}</h1>
  <p>Va a poder leer tus sesiones, series y medidas, y anotar peso, cintura, circunferencias y notas de sesión.</p>
</div>
<p class="foot">${origin} El acceso va a <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
${loopback}
<form method="post">
  <label>Email<input type="email" name="email" autocomplete="username" autocapitalize="none" required value="${escapeHtml(form.email ?? '')}"></label>
  <label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
  ${form.error ? `<p class="error" role="alert">${escapeHtml(form.error)}</p>` : ''}
  <button class="primary" type="submit" name="decision" value="approve">Conectar</button>
  <button class="ghost" type="submit" name="decision" value="deny" formnovalidate>No conectar</button>
</form>
<p class="foot">Usá el email y la contraseña de la app. La contraseña no se guarda.</p>`,
    status,
  )
}

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location } })

export async function authorize(request: Request, env: Env): Promise<Response> {
  const oauth = (env as Env & { OAUTH_PROVIDER: OAuthHelpers }).OAUTH_PROVIDER
  try {
    const authRequest = await oauth.parseAuthRequest(request)
    const details = await oauth.describeConsent(authRequest)
    if (request.method !== 'POST') return signInPage(details)

    const form = await request.formData()
    if (form.get('decision') !== 'approve') {
      return redirect(authorizationErrorRedirect(authRequest, 'access_denied'))
    }
    const email = String(form.get('email') ?? '').trim()
    let props: Awaited<ReturnType<typeof signIn>>
    try {
      props = await signIn(env, email, String(form.get('password') ?? ''))
    } catch {
      return signInPage(
        details,
        {
          email,
          error:
            'No pudimos conectarnos con Supabase. Si el proyecto está pausado, reactivalo desde el dashboard y probá de nuevo.',
        },
        503,
      )
    }
    if (!props) {
      return signInPage(
        details,
        { email, error: 'El email o la contraseña no coinciden. Probá de nuevo.' },
        401,
      )
    }
    const { redirectTo } = await oauth.completeAuthorization({
      request: authRequest,
      userId: props.userId,
      metadata: {},
      scope: authRequest.scope,
      props,
    })
    return redirect(redirectTo)
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return redirect(error.redirectTo)
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      return html(
        'Conectar Gym',
        `${logo}<h1>No se pudo conectar</h1><p>El pedido de conexión no es válido o ya venció. Volvé a conectar desde Claude.</p>`,
        400,
      )
    }
    throw error
  }
}
