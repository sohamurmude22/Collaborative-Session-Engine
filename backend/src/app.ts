import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

// Trust reverse proxy (Render, Cloudflare, etc.)
app.set('trust proxy', 1);

// Security Middleware (Configured to allow Monaco Editor workers, Google fonts, and WebSockets)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS Configuration - supports comma-separated list of allowed origins or wildcard
const rawAllowedOrigins = (
  process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, health checks)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        rawAllowedOrigins.includes('*') ||
        rawAllowedOrigins.includes(cleanOrigin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      // Allow configured origins or fallback to allow in cloud deployments
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  })
);

// Cookie Parsing Middleware
app.use(cookieParser());

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Optional: Serve Frontend Static Assets if Communication/dist exists (Unified Render Web Service mode)
const possibleDistPaths = [
  path.resolve(process.cwd(), 'Communication/dist'),
  path.resolve(process.cwd(), '../Communication/dist'),
  path.resolve(__dirname, '../../Communication/dist')
];
const clientDistPath = possibleDistPaths.find((p) => fs.existsSync(p));

if (clientDistPath) {
  console.log(`[Static] Serving frontend static assets from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  // Client-side SPA routing fallback for non-API requests
  app.get('*', (req: Request, res: Response) => {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(404).json({
        success: false,
        message: `Endpoint ${req.originalUrl} not found`
      });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Fallback for undefined routes (404) when running purely as an API service
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Endpoint ${req.originalUrl} not found`
    });
  });
}

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
