import { Response } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { Session } from '../models/Session.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { PermissionEngine } from '../permissions/PermissionEngine.js';

export const getSessionAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    // Only interviewer or admin can view audit logs
    if (!PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Candidates cannot inspect session audit logs.' }
      });
      return;
    }

    const logs = await AuditLog.find({ sessionId }).sort({ timestamp: -1 }).limit(200);

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const getSessionTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    if (!PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Candidates cannot replay session timelines.' }
      });
      return;
    }

    // Fetch chronologically ordered events for replay
    const timeline = await AuditLog.find({ sessionId }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};
