import { Router, type Response } from 'express'
import { MongoClient, type Db } from 'mongodb'
import { mongoAuthFromEnv, classifyMongoError, isSafeFilterField, type MongoAuthError } from './mongo-auth.js'

const router = Router()

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/'
const WIP_DATABASES = [
  'wip_registry',
  'wip_def_store',
  'wip_template_store',
  'wip_document_store',
]

let client: MongoClient | null = null
// One connect attempt shared by concurrent requests; cleared when it settles,
// so a failed attempt is retried by the next request instead of being cached.
let connecting: Promise<MongoClient> | null = null

/**
 * The cached client, or a new one. Credentials are re-resolved for every new
 * client; `dropClient` discards the cached one after an authentication
 * failure, so a rotated password is picked up on the next request.
 */
async function getClient(): Promise<MongoClient> {
  if (client) return client
  if (connecting) return connecting
  const auth = mongoAuthFromEnv()
  if (auth.configError) throw new Error(auth.configError)
  const c = new MongoClient(MONGO_URI, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
    ...auth.options,
  })
  connecting = c.connect().then(() => (client = c))
  try {
    return await connecting
  } catch (err) {
    await c.close().catch(() => {})
    throw err
  } finally {
    connecting = null
  }
}

async function dropClient(): Promise<void> {
  const c = client
  client = null
  await c?.close().catch(() => {})
}

async function getDb(name: string): Promise<Db> {
  if (!WIP_DATABASES.includes(name)) {
    throw new Error(`Database not in allowed list: ${name}`)
  }
  const c = await getClient()
  return c.db(name)
}

/** Classify an error, dropping the client when its credentials were refused. */
function authErrorOf(err: unknown): MongoAuthError | undefined {
  const authError = classifyMongoError(err, mongoAuthFromEnv().mode)
  if (authError === 'rejected') void dropClient()
  return authError
}

/** 502 with the error message plus, for auth refusals, which kind. Never includes a secret. */
function sendMongoError(res: Response, err: unknown, fallback: string) {
  const auth = mongoAuthFromEnv()
  res.status(502).json({
    error: err instanceof Error ? err.message : fallback,
    auth: auth.mode,
    user: auth.user ?? null,
    auth_error: authErrorOf(err) ?? null,
  })
}

// GET /api/infra/mongo/databases — list WIP databases with collection counts
router.get('/databases', async (_req, res) => {
  try {
    const c = await getClient()
    const results = await Promise.all(
      WIP_DATABASES.map(async (name) => {
        try {
          const db = c.db(name)
          const collections = await db.listCollections().toArray()
          const stats = await db.stats().catch(() => null)
          return {
            name,
            collections: collections.length,
            sizeOnDisk: stats?.dataSize ?? null,
            status: 'ok' as const,
          }
        } catch (err: unknown) {
          return {
            name,
            collections: 0,
            sizeOnDisk: null,
            status: 'error' as const,
            error: err instanceof Error ? err.message : 'Unknown error',
            authError: authErrorOf(err),
            cause: err,
          }
        }
      })
    )
    // A connection without (valid) credentials still connects — only the
    // commands are refused. When every database is refused for an auth
    // reason, report that once instead of four per-database errors.
    const refused = results.find(r => 'authError' in r && r.authError)
    if (refused && results.every(r => r.status === 'error')) {
      sendMongoError(res, (refused as { cause: unknown }).cause, 'Not authorized')
      return
    }
    const auth = mongoAuthFromEnv()
    res.json({
      databases: results.map(({ cause: _cause, authError: _authError, ...r }: Record<string, unknown>) => r),
      auth: auth.mode,
      user: auth.user ?? null,
    })
  } catch (err: unknown) {
    sendMongoError(res, err, 'Connection failed')
  }
})

// GET /api/infra/mongo/collections/:db — list collections in a database
router.get('/collections/:db', async (req, res) => {
  try {
    const db = await getDb(req.params.db)
    const collections = await db.listCollections().toArray()

    const results = await Promise.all(
      collections.map(async (col) => {
        try {
          const coll = db.collection(col.name)
          const [count, indexes] = await Promise.all([
            coll.estimatedDocumentCount(),
            coll.indexes(),
          ])
          return {
            name: col.name,
            type: col.type,
            documentCount: count,
            indexCount: indexes.length,
          }
        } catch {
          return {
            name: col.name,
            type: col.type,
            documentCount: null,
            indexCount: null,
          }
        }
      })
    )

    res.json({ database: req.params.db, collections: results })
  } catch (err: unknown) {
    sendMongoError(res, err, 'Failed to list collections')
  }
})

// GET /api/infra/mongo/indexes/:db/:collection — list indexes
router.get('/indexes/:db/:collection', async (req, res) => {
  try {
    const db = await getDb(req.params.db)
    const indexes = await db.collection(req.params.collection).indexes()
    res.json({ database: req.params.db, collection: req.params.collection, indexes })
  } catch (err: unknown) {
    sendMongoError(res, err, 'Failed to list indexes')
  }
})

// GET /api/infra/mongo/docs/:db/:collection — browse documents (paginated, read-only)
router.get('/docs/:db/:collection', async (req, res) => {
  try {
    const db = await getDb(req.params.db)
    const coll = db.collection(req.params.collection)

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size as string) || 20))
    const skip = (page - 1) * pageSize

    // Optional equality filter on one field. Both parts must be plain strings,
    // and the field a plain path: a `$`-prefixed key such as `$where` would
    // run server-side JavaScript, which the read-only role does not prevent.
    const filter: Record<string, unknown> = {}
    const { filter_field: field, filter_value: value } = req.query
    if (field !== undefined || value !== undefined) {
      if (typeof field !== 'string' || typeof value !== 'string' || !isSafeFilterField(field)) {
        res.status(400).json({ error: 'filter_field must be a plain field path and filter_value a string' })
        return
      }
      filter[field] = value
    }

    const [docs, total] = await Promise.all([
      coll.find(filter).sort({ _id: -1 }).skip(skip).limit(pageSize).toArray(),
      coll.countDocuments(filter),
    ])

    res.json({
      database: req.params.db,
      collection: req.params.collection,
      documents: docs,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    })
  } catch (err: unknown) {
    sendMongoError(res, err, 'Failed to browse documents')
  }
})

export default router
