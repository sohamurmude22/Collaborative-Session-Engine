import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import sessionRoutes from './session.routes.js';
import fileRoutes from './file.routes.js';
import resourceRoutes from './resource.routes.js';
import adminRoutes from './admin.routes.js';
import friendRoutes from './friend.routes.js';

const router = Router();

// Mount API routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/sessions', sessionRoutes);
router.use('/files', fileRoutes);
router.use('/friends', friendRoutes);
router.use('/', resourceRoutes); // mounts /questions, /hints, /testcases
router.use('/admin', adminRoutes);

export default router;
