import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { WebSocketManager } from './websocket/WebSocketManager.js';

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  // Connect to MongoDB
  await connectDB();

  // Create unified HTTP + WebSocket Server
  const server = http.createServer(app);
  new WebSocketManager(server);

  // Start HTTP and WS listener
  server.listen(PORT, () => {
    console.log(`[CSE Server] Collaborative Session Engine Backend listening on port ${PORT}`);
    console.log(`[CSE Server] WebSocket endpoint available at: ws://localhost:${PORT}/ws`);
    console.log(`[CSE Server] Health check available at: http://localhost:${PORT}/api/health`);
  });
};

startServer().catch((error) => {
  console.error('[CSE Server] Failed to start server:', error);
  process.exit(1);
});
