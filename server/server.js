import './loadEnv.js';
import app from './app.js';
import { connectDB } from './config/db.js';

/** Default 5050: macOS often binds Control Center / AirPlay to 5000 */
const port = process.env.PORT || 5050;

async function start() {
  try {
    await connectDB();
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
