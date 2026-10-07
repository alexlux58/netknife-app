/**
 * Standard API Gateway proxy JSON responses.
 * CORS was handled by API Gateway; locally Express + nginx do not need CORS
 * (same-origin /api). Handlers still return { statusCode, headers, body: string }.
 * server/index.js parses `body` before sending to the browser.
 */

function createResponse(statusCode, body, options = {}) {
  const headerStyle = options.headerStyle || 'lowercase'

  const headers = headerStyle === 'title'
    ? {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }
    : {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      }

  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  }
}

module.exports = {
  createResponse,
}
