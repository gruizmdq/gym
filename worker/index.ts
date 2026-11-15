import {
  OAuthError,
  OAuthProvider,
  type OAuthResourceContext,
} from '@cloudflare/workers-oauth-provider'
import { authorize } from './authorize'
import { serveMcp } from './mcp'
import { type Props, refresh } from './supabase'

// The Worker in front of the app: the remote MCP server (/mcp) and its OAuth server. Everything
// else is the app's static files, which never reach this code (run_worker_first in wrangler.jsonc).

const DAY = 86_400

// Our access token lives a bit less than Supabase's: when it expires Claude refreshes it, and
// Gonza's Supabase session is refreshed in the same step.
function accessTokenTTL(props: Props): number {
  return Math.max(60, props.expiresAt - Math.floor(Date.now() / 1000) - 120)
}

function createProvider(origin: string): OAuthProvider<Env> {
  return new OAuthProvider<Env>({
    apiRoute: '/mcp',
    apiHandler: {
      fetch: (request, env, ctx) =>
        serveMcp(request, env, (ctx as OAuthResourceContext<Props>).props),
    },
    defaultHandler: {
      fetch(request, env) {
        if (new URL(request.url).pathname === '/authorize') return authorize(request, env)
        return env.ASSETS.fetch(request)
      },
    },
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/token',
    clientRegistrationEndpoint: '/register',
    clientIdMetadataDocumentEnabled: true,
    resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin] },
    // While Claude keeps using it, the connection never expires; a month idle asks to sign in.
    refreshTokenTTL: 30 * DAY,
    refreshTokenIdleTTL: 30 * DAY,
    tokenExchangeCallback: async ({ grantType, props, env }) => {
      const current = props as Props
      if (grantType === 'authorization_code') return { accessTokenTTL: accessTokenTTL(current) }
      if (grantType !== 'refresh_token') return
      let fresh: Props | 'revoked'
      try {
        fresh = await refresh(env, current.refreshToken)
      } catch {
        throw new OAuthError('temporarily_unavailable', {
          description: 'Supabase is not answering',
          statusCode: 503,
        })
      }
      // The grant can never work again: Claude asks Gonza to sign in.
      if (fresh === 'revoked') {
        throw new OAuthError('invalid_grant', { description: 'The Supabase session is gone' })
      }
      return { newProps: fresh, accessTokenTTL: accessTokenTTL(fresh) }
    },
  })
}

// One provider per origin: the resource (the MCP URL) is bound into every token, and the Worker
// answers on workers.dev, on its preview URLs and on localhost.
const providers = new Map<string, OAuthProvider<Env>>()

export default {
  fetch(request, env, ctx) {
    const origin = new URL(request.url).origin
    let provider = providers.get(origin)
    if (!provider) {
      provider = createProvider(origin)
      providers.set(origin, provider)
    }
    return provider.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
