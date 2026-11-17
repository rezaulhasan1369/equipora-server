import { MongoClient } from 'mongodb';
import { DatabaseConfigurationError } from './db-diagnostics.js';
let cached: Promise<MongoClient> | undefined;
let cachedClient: MongoClient | undefined;
export async function getClient(observe?: (client: MongoClient) => void): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new DatabaseConfigurationError();
  if (!cached) {
    const mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 });
    cachedClient = mongo;
    observe?.(mongo);
    cached = mongo.connect().catch((error: unknown) => { cached = undefined; cachedClient = undefined; throw error; });
  } else if (cachedClient) {
    observe?.(cachedClient);
  }
  return cached;
}
