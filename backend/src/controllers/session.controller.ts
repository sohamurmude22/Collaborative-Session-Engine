import { Response } from 'express';
import crypto from 'crypto';
import { Session, ISessionModel } from '../models/Session.js';
import { User, IUserModel } from '../models/User.js';
import { File } from '../models/File.js';
import { Question } from '../models/Question.js';
import { Hint } from '../models/Hint.js';
import { TestCase } from '../models/TestCase.js';
import { SessionParticipant } from '../models/SessionParticipant.js';
import { AuditLog } from '../models/AuditLog.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { PermissionEngine } from '../permissions/PermissionEngine.js';
import { AuditService } from '../audit/AuditService.js';
import { redisService } from '../services/redis.service.js';

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    const { title, description, candidateEmail, questions } = req.body;

    if (!title) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Session title is required.' }
      });
      return;
    }

    let candidateId = undefined;
    if (candidateEmail) {
      const candidateUser = await User.findOne({ email: candidateEmail.toLowerCase().trim() });
      if (candidateUser) {
        candidateId = candidateUser._id;
      }
    }

    // Generate readable secure session code, e.g. CSE-7A9B3C
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const sessionCode = `CSE-${randomHex}`;

    const session = await Session.create({
      title,
      description: description || '',
      interviewerId: user._id,
      candidateId,
      organizationId: user.organizationId,
      status: 'ACTIVE',
      startedAt: new Date(),
      sessionCode
    });

    // Automatically add creator as participant
    await SessionParticipant.create({
      sessionId: session._id,
      userId: user._id,
      role: user.role,
      status: 'ONLINE',
      lastSeen: Date.now()
    });

    // If candidate assigned, add participant entry for them
    if (candidateId) {
      await SessionParticipant.create({
        sessionId: session._id,
        userId: candidateId,
        role: 'CANDIDATE',
        status: 'OFFLINE',
        lastSeen: Date.now()
      });
    }

    // Create a default initial file: main.cpp (VISIBLE_EDITABLE)
    await File.create({
      sessionId: session._id,
      name: 'main.cpp',
      language: 'cpp',
      content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, CSE Collaborative Session!" << std::endl;\n    return 0;\n}\n`,
      permission: 'VISIBLE_EDITABLE'
    });

    // Handle optional initial questions (with support for revealed or hidden by default)
    if (Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q && q.title) {
          await Question.create({
            sessionId: session._id,
            title: q.title.trim(),
            description: q.description || '',
            difficulty: q.difficulty || 'MEDIUM',
            order: i + 1,
            status: q.status === 'REVEALED' ? 'REVEALED' : 'HIDDEN'
          });
        }
      }
    }

    // Audit log
    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'SESSION_CREATED',
      resourceType: 'SESSION',
      resourceId: session._id.toString(),
      metadata: { sessionCode, title }
    });

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let query: any = {};

    if (user.role === 'ADMIN') {
      // Admin sees all sessions
      query = {};
    } else {
      // User sees sessions where they are host/creator, assigned candidate, or in participants
      const participations = await SessionParticipant.find({ userId: user._id });
      const sessionIds = participations.map((p) => p.sessionId);
      query = {
        $or: [
          { interviewerId: user._id },
          { candidateId: user._id },
          { _id: { $in: sessionIds } }
        ]
      };
    }

    const sessions = await Session.find(query)
      .populate('interviewerId', 'name email role avatarUrl')
      .populate('candidateId', 'name email role avatarUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const getSessionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const session = await Session.findById(id)
      .populate('interviewerId', 'name email role avatarUrl')
      .populate('candidateId', 'name email role avatarUrl');

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const check = PermissionEngine.canViewSession(user, session);
    if (!check.allowed) {
      // If user is candidate, allow them to join/bind themselves if not already bound
      if (user.role === 'CANDIDATE' && !session.candidateId) {
        session.candidateId = user._id;
        await session.save();
      } else {
        res.status(check.statusCode || 403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: check.reason }
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const getSessionByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const code = String(req.params.code);

    const session = await Session.findOne({ sessionCode: code.toUpperCase() })
      .populate('interviewerId', 'name email role')
      .populate('candidateId', 'name email role');

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session with this code does not exist.' }
      });
      return;
    }

    // If candidate joins and candidateId is empty, bind them
    if (user.role === 'CANDIDATE' && !session.candidateId) {
      session.candidateId = user._id;
      if (session.status === 'CREATED') {
        session.status = 'WAITING';
      }
      await session.save();
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const startSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const session = await Session.findById(req.params.id);

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const check = PermissionEngine.canManageSession(user, session);
    if (!check.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: check.reason }
      });
      return;
    }

    session.status = 'ACTIVE';
    if (!session.startedAt) {
      session.startedAt = new Date();
    }
    await session.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'SESSION_STARTED',
      resourceType: 'SESSION',
      resourceId: session._id.toString()
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'SESSION_STATUS_CHANGED',
      sessionId: session._id.toString(),
      payload: { status: 'ACTIVE' }
    });

    res.status(200).json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const pauseSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const session = await Session.findById(req.params.id);

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const check = PermissionEngine.canManageSession(user, session);
    if (!check.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: check.reason }
      });
      return;
    }

    session.status = 'PAUSED';
    await session.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'SESSION_PAUSED',
      resourceType: 'SESSION',
      resourceId: session._id.toString()
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'SESSION_STATUS_CHANGED',
      sessionId: session._id.toString(),
      payload: { status: 'PAUSED' }
    });

    res.status(200).json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const endSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const session = await Session.findById(req.params.id);

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const check = PermissionEngine.canManageSession(user, session);
    if (!check.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: check.reason }
      });
      return;
    }

    session.status = 'COMPLETED';
    session.endedAt = new Date();
    await session.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'SESSION_ENDED',
      resourceType: 'SESSION',
      resourceId: session._id.toString()
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'SESSION_STATUS_CHANGED',
      sessionId: session._id.toString(),
      payload: { status: 'COMPLETED' }
    });

    res.status(200).json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const getUsersList = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({}, 'name email role _id').sort({ name: 1 });
    res.status(200).json({
      success: true,
      data: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const addParticipant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;
    const { email, userId, role } = req.body;

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const isHost = session.interviewerId.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === 'ADMIN';
    if (!isHost && !isAdmin) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the session host or admin can add participants.' }
      });
      return;
    }

    let targetUser = null;
    if (userId) {
      targetUser = await User.findById(userId);
    } else if (email) {
      targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    }

    if (!targetUser) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found with provided email or ID.' }
      });
      return;
    }

    // If session has no candidate assigned, assign this user if appropriate
    if (!session.candidateId && targetUser._id.toString() !== session.interviewerId.toString()) {
      session.candidateId = targetUser._id;
      await session.save();
    }

    const participantRole = role || targetUser.role;

    const participant = await SessionParticipant.findOneAndUpdate(
      { sessionId: session._id, userId: targetUser._id },
      {
        role: participantRole,
        status: 'ONLINE',
        lastSeen: Date.now()
      },
      { upsert: true, new: true }
    ).populate('userId', 'name email role');

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: currentUser._id.toString(),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      eventType: 'USER_JOINED',
      resourceType: 'SESSION',
      resourceId: session._id.toString(),
      metadata: { invitedEmail: targetUser.email, invitedName: targetUser.name }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'USER_JOINED',
      sessionId: session._id.toString(),
      payload: {
        userId: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        role: participantRole,
        status: 'ONLINE'
      }
    });

    res.status(200).json({
      success: true,
      data: {
        message: `${targetUser.name} added to session.`,
        participant,
        session
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const toggleMasterLock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { locked } = req.body;

    const session = await Session.findById(id);
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
        error: { code: 'FORBIDDEN', message: 'Only session host or admin can toggle master lock.' }
      });
      return;
    }

    const isLocking = Boolean(locked);
    const newPermission = isLocking ? 'LOCKED' : 'VISIBLE_EDITABLE';
    await File.updateMany({ sessionId: session._id }, { permission: newPermission });

    const updatedFiles = await File.find({ sessionId: session._id }).sort({ createdAt: 1 });

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: (isLocking ? 'SESSION_LOCKED' : 'SESSION_UNLOCKED') as any,
      resourceType: 'SESSION',
      resourceId: session._id.toString(),
      metadata: { masterLocked: isLocking, affectedFiles: updatedFiles.length }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'PERMISSION_ENGINE_LOCKED',
      sessionId: session._id.toString(),
      payload: {
        locked: isLocking,
        actorName: user.name,
        files: updatedFiles.map((f) => ({
          id: f._id.toString(),
          name: f.name,
          permission: f.permission
        }))
      }
    });

    res.status(200).json({
      success: true,
      data: {
        locked: isLocking,
        message: isLocking
          ? 'Lock Permission Engine engaged: All editor inputs frozen.'
          : 'Lock Permission Engine disengaged: Editor unlocked.',
        files: updatedFiles
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const leaveSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { resetDatabase: shouldReset } = req.body;

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } });
      return;
    }

    // Mark participant left
    await SessionParticipant.findOneAndUpdate(
      { sessionId: session._id, userId: user._id },
      { status: 'OFFLINE', leftAt: new Date(), lastSeen: Date.now() }
    );

    // Notify other participants
    await redisService.publish(`session:${session._id}:events`, {
      type: 'USER_LEFT',
      sessionId: session._id.toString(),
      payload: {
        userId: user._id.toString(),
        name: user.name,
        role: user.role
      }
    });

    // Reset database & remove demo account on session leave
    if (shouldReset || PermissionEngine.isInterviewerOrAdmin(user, session)) {
      await File.deleteMany({ sessionId: session._id });
      await Question.deleteMany({ sessionId: session._id });
      await Hint.deleteMany({ sessionId: session._id });
      await TestCase.deleteMany({ sessionId: session._id });
      await SessionParticipant.deleteMany({ sessionId: session._id });
      await AuditLog.deleteMany({ sessionId: session._id });
      session.status = 'COMPLETED';
      session.endedAt = new Date();
      await session.save();

      // Remove the demo accounts
      await User.deleteMany({
        email: { $in: ['interviewer@cse.com', 'candidate@cse.com', 'admin@cse.com'] }
      });

      await redisService.publish(`session:${session._id}:events`, {
        type: 'SESSION_RESET',
        sessionId: session._id.toString(),
        payload: {
          message: 'Session has ended, database was reset, and demo accounts removed.'
        }
      });
    }

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'USER_LEFT',
      resourceType: 'SESSION',
      resourceId: session._id.toString(),
      metadata: { action: 'LEAVE_SESSION', resetDatabase: !!shouldReset }
    });

    res.status(200).json({
      success: true,
      data: { message: 'Left session successfully. Session data cleaned and demo accounts removed.' }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const issueWarning = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { targetUserId, message } = req.body;

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } });
      return;
    }

    const check = PermissionEngine.canIssueWarning(user, session);
    if (!check.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: check.reason } });
      return;
    }

    const warningText = message || 'Warning: Suspicious activity or rule violation detected.';

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'USER_WARNING',
      resourceType: 'SESSION',
      resourceId: targetUserId,
      metadata: { targetUserId, message: warningText }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'USER_WARNING',
      sessionId: session._id.toString(),
      payload: {
        issuerId: user._id.toString(),
        issuerName: user.name,
        targetUserId,
        message: warningText,
        timestamp: Date.now()
      }
    });

    res.status(200).json({
      success: true,
      data: { message: 'Warning issued to participant.' }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const blockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { targetUserId, reason } = req.body;

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } });
      return;
    }

    const check = PermissionEngine.canBlockUser(user, session);
    if (!check.allowed) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: check.reason } });
      return;
    }

    const blockReason = reason || 'Suspicious activity detected. Access blocked by interviewer.';

    // Update SessionParticipant
    await SessionParticipant.findOneAndUpdate(
      { sessionId: session._id, userId: targetUserId },
      { isBlocked: true, blockedReason: blockReason }
    );

    // Freeze all files
    await File.updateMany({ sessionId: session._id }, { permission: 'LOCKED' });

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'USER_BLOCKED',
      resourceType: 'SESSION',
      resourceId: targetUserId,
      metadata: { targetUserId, reason: blockReason }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'USER_BLOCKED',
      sessionId: session._id.toString(),
      payload: {
        targetUserId,
        blockedBy: user.name,
        reason: blockReason,
        timestamp: Date.now()
      }
    });

    res.status(200).json({
      success: true,
      data: { message: 'User blocked for suspicious activity.' }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const unblockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { targetUserId } = req.body;

    const session = await Session.findById(id);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
      return;
    }

    await SessionParticipant.findOneAndUpdate(
      { sessionId: session._id, userId: targetUserId },
      { isBlocked: false, blockedReason: '' }
    );

    await File.updateMany({ sessionId: session._id }, { permission: 'VISIBLE_EDITABLE' });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'USER_JOINED',
      sessionId: session._id.toString(),
      payload: { userId: targetUserId, isBlocked: false, status: 'ONLINE' }
    });

    res.status(200).json({ success: true, data: { message: 'User unblocked.' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

export const lockScreen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { reason } = req.body;

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } });
      return;
    }

    if (!PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only interviewers can lock screen.' } });
      return;
    }

    session.isScreenLocked = true;
    (session as any).screenLockedReason = reason || 'Session screen locked by interviewer.';
    await session.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'SCREEN_LOCKED',
      resourceType: 'SESSION',
      resourceId: session._id.toString(),
      metadata: { reason }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'SCREEN_LOCKED',
      sessionId: session._id.toString(),
      payload: {
        isScreenLocked: true,
        lockedBy: user.name,
        reason: reason || 'Session screen locked by interviewer.'
      }
    });

    res.status(200).json({ success: true, data: { isScreenLocked: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

export const unlockScreen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } });
      return;
    }

    if (!PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only interviewers can unlock screen.' } });
      return;
    }

    session.isScreenLocked = false;
    (session as any).screenLockedReason = '';
    await session.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'SCREEN_UNLOCKED',
      resourceType: 'SESSION',
      resourceId: session._id.toString()
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'SCREEN_LOCKED',
      sessionId: session._id.toString(),
      payload: {
        isScreenLocked: false,
        unlockedBy: user.name
      }
    });

    res.status(200).json({ success: true, data: { isScreenLocked: false } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const session = await Session.findById(req.params.id);

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    // Ensure user is authorized: admin, interviewer, creator, or assigned candidate
    const currentUserId = user._id ? user._id.toString() : (user as any).id;
    const interviewerId = PermissionEngine.extractId(session.interviewerId);
    const candidateId = PermissionEngine.extractId(session.candidateId);

    const isAuthorized =
      user.role === 'ADMIN' ||
      user.role === 'INTERVIEWER' ||
      interviewerId === currentUserId ||
      candidateId === currentUserId;

    if (!isAuthorized) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to delete this session record.' }
      });
      return;
    }

    const sessionIdStr = session._id.toString();

    // Cascading clean up associated session records & history
    await Promise.all([
      Session.findByIdAndDelete(sessionIdStr),
      File.deleteMany({ sessionId: session._id }),
      SessionParticipant.deleteMany({ sessionId: session._id }),
      Question.deleteMany({ sessionId: session._id }),
      AuditLog.deleteMany({ sessionId: sessionIdStr }),
      Hint.deleteMany({ sessionId: session._id }).catch(() => {}),
      TestCase.deleteMany({ sessionId: session._id }).catch(() => {})
    ]);

    // Publish event to Redis if active subscribers exist
    await redisService.publish(`session:${sessionIdStr}:events`, {
      type: 'SESSION_RESET',
      sessionId: sessionIdStr,
      payload: { message: 'Session history deleted', deletedBy: user.name }
    }).catch(() => {});

    res.status(200).json({
      success: true,
      data: { id: sessionIdStr, message: 'Session history and records deleted successfully.' }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const resetSystemDatabase = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.deleteMany({
      email: { $in: ['interviewer@cse.com', 'candidate@cse.com', 'admin@cse.com'] }
    });
    res.status(200).json({
      success: true,
      data: { message: 'Database reset: demo accounts removed.' }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
};


