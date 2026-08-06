import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

// Next.js hot-reloads modules in dev; without a global cache each reload opens
// a fresh pool and the connection count climbs until Mongo refuses new ones.
declare global {
  var _mongoose: MongooseCache | undefined
}

const cached: MongooseCache = global._mongoose ?? { conn: null, promise: null }
global._mongoose = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env.local and point it at your database.',
    )
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10_000,
      })
      .catch((err) => {
        // Clear the rejected promise so the next request retries instead of
        // replaying the same failure forever.
        cached.promise = null
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}
