import { MongoClient } from 'mongodb';
let cached: Promise<MongoClient> | undefined;
export async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Database is not configured');
  if (!cached) {
    const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 });
    cached = mongo.connect().catch((error: unknown) => { cached = undefined; throw error; });
  }
  return cached;
}
