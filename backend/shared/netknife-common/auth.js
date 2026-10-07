/**
 * JWT claim helpers used by every authenticated handler.
 *
 * Original: API Gateway JWT authorizer puts claims on
 *   event.requestContext.authorizer.jwt.claims
 * Local VM: server/index.js synthesizes the same shape (localClaims).
 *
 * Cognito access tokens use `username`; ID tokens use `cognito:username`.
 * Always go through getUsername() — do not read a single claim key.
 */

function getClaims(event) {
  let claims = {}
  if (event.requestContext?.authorizer?.jwt?.claims) {
    claims = event.requestContext.authorizer.jwt.claims
  } else if (event.requestContext?.authorizer?.claims) {
    claims = event.requestContext.authorizer.claims
  } else if (event.requestContext?.authorizer) {
    const auth = event.requestContext.authorizer
    if (auth.sub || auth['cognito:username'] || auth.username) {
      claims = auth
    }
  }
  if (Object.keys(claims).length === 0) {
    const authHeader = event.headers?.authorization || event.headers?.Authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const parts = authHeader.substring(7).split('.')
        if (parts.length === 3) {
          claims = JSON.parse(Buffer.from(parts[1], 'base64').toString())
        }
      } catch {
        /* ignore */
      }
    }
  }
  return claims
}

/** Cognito access tokens use `username`; ID tokens use `cognito:username`. */
function getUsername(event) {
  const claims = getClaims(event)
  return String(
    claims['cognito:username'] || claims.username || claims.preferred_username || ''
  ).trim()
}

function getUserId(event) {
  const claims = getClaims(event)
  return claims.sub || claims['cognito:username'] || claims.username || 'unknown'
}

module.exports = { getClaims, getUsername, getUserId }
