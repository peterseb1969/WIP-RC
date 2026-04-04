import { Router } from 'express'
import { MongoClient, type Db } from 'mongodb'

const router = Router()

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/'
const WIP_DATABASES = [
  'wip_registry',
  'wip_def_store',
  'wip_template_store',
  'wip_document_store',
]

let client: MongoClient | null = null

async function getClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(MONGO_URI, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    })
    await client.connect()
  }
  return client
}

async function getDb(name: string): Promise<Db> {
  if (!WIP_DATABASES.includes(name)) {
    throw new Error(`Database not in allowed list: ${name}`)
  }
  const c = await getClient()
  return c.db(name)
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
          }
        }
      })
    )
    res.json({ databases: results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    res.status(502).json({ error: message })
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
    const message = err instanceof Error ? err.message : 'Failed to list collections'
    res.status(502).json({ error: message })
  }
})

// GET /api/infra/mongo/indexes/:db/:collection — list indexes
router.get('/indexes/:db/:collection', async (req, res) => {
  try {
    const db = await getDb(req.params.db)
    const indexes = await db.collection(req.params.collection).indexes()
    res.json({ database: req.params.db, collection: req.params.collection, indexes })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list indexes'
    res.status(502).json({ error: message })
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

    // Optional filter by field value
    const filter: Record<string, unknown> = {}
    if (req.query.filter_field && req.query.filter_value) {
      filter[req.query.filter_field as string] = req.query.filter_value
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
    const message = err instanceof Error ? err.message : 'Failed to browse documents'
    res.status(502).json({ error: message })
  }
})

export default router
