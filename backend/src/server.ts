import dotenv from 'dotenv';

// Load environment variables before importing app/db config
dotenv.config();

import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  // Connect to MongoDB
  await connectDB();

  // Start HTTP listener
  app.listen(PORT, () => {
    console.log(`[Server] Collaborative Session Engine Backend listening on port ${PORT}`);
    console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
  });
};

startServer().catch((error) => {
  console.error('[Server] Failed to start server:', error);
  process.exit(1);
});
