import { Router } from 'express';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { Session } from '../models/Session.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateUser, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);
router.use(requireRole('ADMIN'));

router.get('/stats', async (_req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSessions = await Session.countDocuments();
    const totalLogs = await AuditLog.countDocuments();

    res.status(200).json({
      success: true,
      data: { totalUsers, totalSessions, totalLogs }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/audit-logs', async (_req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
    res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;
