/**
 * Public surface of netknife-common.
 * Functions `require('netknife-common')` — locally that is a copied folder
 * under backend/functions/<id>/node_modules (scripts/prepare-shared.sh).
 */
const { createResponse } = require('./http')
const { createCacheClient } = require('./cache')
const { getClaims, getUsername, getUserId } = require('./auth')

module.exports = {
  createResponse,
  createCacheClient,
  getClaims,
  getUsername,
  getUserId,
}
