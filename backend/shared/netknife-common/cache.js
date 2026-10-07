/**
 * Cache backend for NetKnife handlers.
 *
 * Lambda (original): DynamoDB table CACHE_TABLE, item cache_key + expires_at + data|value.
 * Local VM:          in-memory Map when CACHE_TABLE is unset OR LOCAL_MEMORY_CACHE=true.
 *
 * Agents: do not add a second cache API. All tools go through createCacheClient().
 * Payload field is `data` for most functions and `value` for dns/rdap.
 */

const memoryStore = new Map()

function createMemoryCache(payloadField = 'data') {
  return {
    async get(cacheKey) {
      const item = memoryStore.get(cacheKey)
      if (!item) return null
      if (item.expires_at <= Math.floor(Date.now() / 1000)) {
        memoryStore.delete(cacheKey)
        return null
      }
      return item[payloadField]
    },
    async put(cacheKey, value, ttlSeconds) {
      memoryStore.set(cacheKey, {
        [payloadField]: value,
        expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
      })
    },
  }
}

function createDynamoCache(options) {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
  const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
  const {
    dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({})),
    cacheTable,
    payloadField = 'data',
    logReadError = (error) => console.error('Cache read error:', error),
    logWriteError = (error) => console.error('Cache write error:', error),
  } = options

  return {
    async get(cacheKey) {
      if (!cacheTable) return null
      try {
        const result = await dynamodb.send(new GetCommand({
          TableName: cacheTable,
          Key: { cache_key: cacheKey },
        }))
        if (!result.Item) return null
        if (result.Item.expires_at <= Math.floor(Date.now() / 1000)) return null
        return result.Item[payloadField]
      } catch (error) {
        logReadError(error)
        return null
      }
    },
    async put(cacheKey, value, ttlSeconds) {
      if (!cacheTable) return
      try {
        await dynamodb.send(new PutCommand({
          TableName: cacheTable,
          Item: {
            cache_key: cacheKey,
            [payloadField]: value,
            expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
          },
        }))
      } catch (error) {
        logWriteError(error)
      }
    },
  }
}

/**
 * DynamoDB cache table helpers (cache_key + expires_at TTL).
 * Supports legacy payload fields: `data` (most functions) or `value` (dns, rdap).
 */
function createCacheClient(options = {}) {
  const cacheTable = options.cacheTable ?? process.env.CACHE_TABLE
  const payloadField = options.payloadField || 'data'
  if (!cacheTable || process.env.LOCAL_MEMORY_CACHE === 'true') {
    return createMemoryCache(payloadField)
  }
  return createDynamoCache({ ...options, cacheTable, payloadField })
}

module.exports = {
  createCacheClient,
}
