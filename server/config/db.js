import mongoose from 'mongoose';

/**
 * Connects to MongoDB. Call once on server startup.
 * Uses MONGODB_URI from environment.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env and configure your Atlas URI.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}
