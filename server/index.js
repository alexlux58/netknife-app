/**
 * ==============================================================================
 * NETKNIFE-APP — LOCAL API ADAPTER
 * ==============================================================================
 *
 * PURPOSE
 *   The original NetKnife backend is one AWS Lambda per tool. This process is a
 *   thin Express server that:
 *     1. Accepts the same POST paths API Gateway used (/dns, /rdap, …)
 *     2. Builds a fake API Gateway HTTP API event (body + JWT claims)
 *     3. Calls backend/functions/<name>/index.js → exports.handler(event)
 *     4. Unwraps { statusCode, body } back into a normal HTTP response
 *
 * FRONTEND
 *   Vite is built with VITE_API_URL=/api. nginx strips the /api prefix and
 *   proxies to this process (default :3001). Do not change path names here
 *   without updating frontend apiPost() calls and nginx.
 *
 * AUTH
 *   Cognito is not in this stack. Any Authorization: Bearer <token> is treated
 *   as the local operator (LOCAL_USERNAME, default alexlux). Empty auth → 401
 *   except POST /billing/webhook (unused locally).
 *
 * BILLING
 *   POST /billing { action: "usage" } is answered here with a grandfathered
 *   plan so the SPA enables remote tools. Set LOCAL_FULL_ACCESS=false to fall
 *   through to the real billing handler (needs DynamoDB + Stripe).
 *
 * AGENTS
 *   To add a route: append to ROUTES, keep exports.handler in the function
 *   folder. See ../AGENTS.md and ../docs/ARCHITECTURE-LOCAL.md.
 * ==============================================================================
 */

const path = require('path')
const express = require('express')

/** Directory of original Lambda packages (each has index.js + optional validation.js). */
const FUNCTIONS_DIR = path.join(__dirname, '..', 'backend', 'functions')

/** Bind address is 0.0.0.0 so Docker/nginx on another interface can reach us. */
const PORT = Number(process.env.PORT || 3001)

/**
 * HTTP path → function folder name.
 * Keys MUST match what the SPA posts (apiPost('/dns') → '/dns').
 * Values MUST match backend/functions/<folder>.
 */
const ROUTES = {
  '/dns': 'dns',
  '/rdap': 'rdap',
  '/tls': 'tls',
  '/headers': 'headers',
  '/peeringdb': 'peeringdb',
  '/reverse-dns': 'reverse-dns',
  '/email-auth': 'email-auth',
  '/hibp': 'hibp',
  '/abuseipdb': 'abuseipdb',
  '/dns-propagation': 'dns-propagation',
  '/asn-details': 'asn-details',
  '/bgp-looking-glass': 'bgp-looking-glass',
  '/ssl-labs': 'ssl-labs',
  '/traceroute': 'traceroute',
  '/shodan': 'shodan',
  '/virustotal': 'virustotal',
  '/security-trails': 'security-trails',
  '/censys': 'censys',
  '/greynoise': 'greynoise',
  '/emailrep': 'emailrep',
  '/ip-api': 'ip-api',
  '/breachdirectory': 'breachdirectory',
  '/phone-validator': 'phone-validator',
  '/ipqualityscore': 'ipqualityscore',
  '/ipqs-email': 'ipqs-email',
  '/ipqs-phone': 'ipqs-phone',
  '/ipqs-url': 'ipqs-url',
  '/hunter': 'hunter',
  '/security-advisor': 'security-advisor',
  '/reports': 'reports',
  '/guides': 'guides',
  '/scanners': 'scanners',
  '/cve-lookup': 'cve-lookup',
  '/profile': 'profile',
  '/board': 'board',
  '/alarms': 'alarms',
  '/billing': 'billing',
  '/billing/webhook': 'billing',
  '/labs': 'labs',
}

/**
 * Load a Lambda module. Prefer named `handler`; fall back to module.exports
 * if a function used a default export.
 */
function loadHandler(folder) {
  const mod = require(path.join(FUNCTIONS_DIR, folder, 'index.js'))
  return mod.handler || mod
}

/**
 * Eager-load handlers at boot so /health can report what is actually available.
 * Missing AWS SDK or a bad require must not crash the whole server — we skip
 * that tool and return 503 for its route.
 */
const handlers = {}
for (const folder of new Set(Object.values(ROUTES))) {
  try {
    handlers[folder] = loadHandler(folder)
    console.log(`loaded ${folder}`)
  } catch (err) {
    console.warn(`skip ${folder}: ${err.message}`)
  }
}

/**
 * Synthesize Cognito-style JWT claims from env.
 * Handlers look at cognito:username, username, and sub (see netknife-common/auth.js).
 *
 * @returns {object|null} claims, or null if the request has no Bearer token
 */
function localClaims(req) {
  const auth = req.headers.authorization || req.headers.Authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const username = process.env.LOCAL_USERNAME || 'alexlux'
  return {
    sub: process.env.LOCAL_USER_SUB || 'local-user',
    username,
    'cognito:username': username,
    preferred_username: username,
    email: process.env.LOCAL_EMAIL || 'alexlux@local',
    name: process.env.LOCAL_NAME || 'Alex Lux (Local)',
  }
}

/**
 * API Gateway HTTP API (payload 2.0) subset that our Lambdas actually read.
 */
function toLambdaEvent(req) {
  const claims = localClaims(req)
  return {
    body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
    headers: {
      authorization: req.headers.authorization || '',
      Authorization: req.headers.authorization || '',
      'content-type': req.headers['content-type'] || 'application/json',
    },
    requestContext: {
      http: { method: req.method, path: req.path },
      ...(claims ? { authorizer: { jwt: { claims }, claims } } : {}),
    },
    rawPath: req.path,
  }
}

/**
 * Lambdas return { statusCode, headers, body: stringified JSON }.
 * Express already JSON-encodes objects, so we parse body first.
 */
function sendLambdaResponse(res, result) {
  const status = result?.statusCode || 200
  const headers = result?.headers || {}
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'content-type') continue
    res.setHeader(k, v)
  }
  res.status(status)
  if (result?.body == null) return res.end()
  try {
    return res.json(typeof result.body === 'string' ? JSON.parse(result.body) : result.body)
  } catch {
    return res.send(result.body)
  }
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))

/** Liveness + list of handlers that loaded (for ops / agents debugging a 503). */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'local',
    routes: Object.keys(ROUTES).filter((r) => handlers[ROUTES[r]]),
  })
})

/**
 * Default: unlock the SPA remote-tool gate without Stripe.
 * Only intercepts action=usage so checkout/portal can still hit the real handler.
 */
app.post('/billing', (req, res, next) => {
  if (process.env.LOCAL_FULL_ACCESS === 'false') return next()
  const action = req.body?.action || 'usage'
  if (action !== 'usage') return next()
  return res.json({
    plan: 'grandfathered',
    usage: { remoteCalls: 0, advisorMessages: 0, reportSaves: 0 },
    limits: { remote: 999999, advisor: 999999, report_save: 999999 },
    isGrandfathered: true,
    hasSubscription: false,
  })
})

for (const [route, folder] of Object.entries(ROUTES)) {
  app.post(route, async (req, res) => {
    const handler = handlers[folder]
    if (!handler) {
      return res.status(503).json({
        error: `${folder} is not available in this local build`,
        hint: 'Run npm install at the app root (AWS SDK) and scripts/prepare-shared.sh',
      })
    }
    if (!localClaims(req) && route !== '/billing/webhook') {
      return res.status(401).json({ error: 'Authentication required' })
    }
    try {
      const result = await handler(toLambdaEvent(req))
      sendLambdaResponse(res, result)
    } catch (err) {
      console.error(`${route} failed:`, err)
      res.status(500).json({ error: err.message || 'Handler failed' })
    }
  })
}

app.use((req, res) => {
  res.status(404).json({ error: `No local route for ${req.method} ${req.path}` })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NetKnife API listening on ${PORT} (local adapter — see AGENTS.md)`)
})
