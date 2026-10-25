import { Response } from 'express';
import { Session } from '../models/Session.js';
import { File, IFileModel } from '../models/File.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { PermissionEngine } from '../permissions/PermissionEngine.js';
import { AuditService } from '../audit/AuditService.js';
import { redisService } from '../services/redis.service.js';
import { FilePermission } from '../types/cse.js';

export const getFiles = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const isInterviewerOrAdmin = PermissionEngine.isInterviewerOrAdmin(user, session);

    // CRITICAL: Candidates must NOT see HIDDEN files. Filter at query level.
    const fileQuery: any = { sessionId };
    if (!isInterviewerOrAdmin) {
      fileQuery.permission = { $ne: 'HIDDEN' };
    }

    const files = await File.find(fileQuery).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: files
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const getFileById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const file = await File.findById(id);
    if (!file) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' }
      });
      return;
    }

    const session = await Session.findById(file.sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Associated session not found.' }
      });
      return;
    }

    const check = PermissionEngine.canViewFile(user, session, file);
    if (!check.allowed) {
      res.status(check.statusCode || 403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: check.reason }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: file
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const createFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const sessionId = String(req.params.sessionId);
    const { name, language, content, permission } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    // Check authority: user who created session OR interviewer OR admin
    const isCreator =
      session.interviewerId &&
      session.interviewerId.toString() === user._id.toString();
    const isInterviewer =
      user.role === 'INTERVIEWER' ||
      user.role === 'ADMIN' ||
      PermissionEngine.isInterviewerOrAdmin(user, session);

    if (!isCreator && !isInterviewer) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the session creator or an interviewer can add files to the session.' }
      });
      return;
    }

    let fileName = (name || 'file.cpp').trim();
    if (!fileName.includes('.')) {
      fileName += '.cpp';
    }
    const detectedLang = fileName.endsWith('.cpp')
      ? 'cpp'
      : fileName.endsWith('.py')
      ? 'python'
      : language || 'cpp';

    const file = await File.create({
      sessionId,
      name: fileName,
      language: detectedLang,
      content:
        content !== undefined
          ? content
          : detectedLang === 'cpp'
          ? `// ${fileName}\n#include <iostream>\n\nvoid ${fileName.replace(/[^a-zA-Z0-9]/g, '_')}() {\n    // Implementation\n}\n`
          : `// ${fileName}\n`,
      permission: permission || 'VISIBLE_EDITABLE'
    });

    await AuditService.log({
      sessionId,
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'FILE_CREATED',
      resourceType: 'FILE',
      resourceId: file._id.toString(),
      metadata: { fileName: file.name, permission: file.permission }
    });

    await redisService.publish(`session:${sessionId}:events`, {
      type: 'FILE_CREATED',
      sessionId,
      payload: file.toJSON()
    });

    res.status(201).json({
      success: true,
      data: file
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const renameFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid file name is required.' }
      });
      return;
    }

    const file = await File.findById(id);
    if (!file) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' }
      });
      return;
    }

    const session = await Session.findById(file.sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    // Check authority: user who created session OR interviewer OR admin
    const isCreator =
      session.interviewerId &&
      session.interviewerId.toString() === user._id.toString();
    const isInterviewer =
      user.role === 'INTERVIEWER' ||
      user.role === 'ADMIN' ||
      PermissionEngine.isInterviewerOrAdmin(user, session);

    if (!isCreator && !isInterviewer) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the session creator or an interviewer can rename files.' }
      });
      return;
    }

    const oldName = file.name;
    let cleanName = name.trim();
    if (!cleanName.includes('.')) {
      cleanName += '.cpp';
    }
    file.name = cleanName;
    if (cleanName.endsWith('.cpp')) {
      file.language = 'cpp';
    } else if (cleanName.endsWith('.py')) {
      file.language = 'python';
    }
    await file.save();

    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'FILE_RENAMED',
      resourceType: 'FILE',
      resourceId: file._id.toString(),
      metadata: { oldName, newName: file.name }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'FILE_RENAMED',
      sessionId: session._id.toString(),
      payload: {
        fileId: file._id.toString(),
        oldName,
        name: file.name,
        language: file.language,
        renamedBy: user.name
      }
    });

    res.status(200).json({
      success: true,
      data: file
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const updateFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { content, delta, isPaste, line } = req.body;

    const file = await File.findById(id);
    if (!file) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' }
      });
      return;
    }

    const session = await Session.findById(file.sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    // STRICT VALIDATION BY PERMISSION ENGINE
    const check = PermissionEngine.canEditFile(user, session, file);
    if (!check.allowed) {
      // Log permission denied attempt
      await AuditService.log({
        sessionId: session._id.toString(),
        actorId: user._id.toString(),
        actorName: user.name,
        actorRole: user.role,
        eventType: 'PERMISSION_DENIED',
        resourceType: 'FILE',
        resourceId: file._id.toString(),
        metadata: {
          attempt: 'FILE_EDIT',
          fileName: file.name,
          reason: check.reason,
          filePermission: file.permission
        }
      });

      res.status(check.statusCode || 403).json({
        success: false,
        error: {
          code: file.permission === 'LOCKED' ? 'FILE_LOCKED' : 'PERMISSION_DENIED',
          message: check.reason
        }
      });
      return;
    }

    if (content !== undefined) {
      file.content = content;
      await file.save();
    }

    // Check for suspicious paste or edit burst
    if (delta || isPaste) {
      await AuditService.detectSuspiciousActivity(
        session._id.toString(),
        user._id.toString(),
        user.name,
        user.role,
        file._id.toString(),
        delta || '',
        isPaste
      );
    }

    // Record edit audit event
    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'FILE_EDITED',
      resourceType: 'FILE',
      resourceId: file._id.toString(),
      metadata: {
        fileName: file.name,
        line: line || 1,
        length: file.content.length
      }
    });

    await redisService.publish(`session:${session._id}:events`, {
      type: 'FILE_UPDATED',
      sessionId: session._id.toString(),
      payload: {
        fileId: file._id.toString(),
        content: file.content,
        updatedBy: user.name
      }
    });

    res.status(200).json({
      success: true,
      data: file
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const setFilePermission = async (
  req: AuthRequest,
  res: Response,
  newPermission: FilePermission,
  eventType: any
): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const file = await File.findById(id);
    if (!file) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' }
      });
      return;
    }

    const session = await Session.findById(file.sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const check = PermissionEngine.canChangeFilePermission(user, session);
    if (!check.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: check.reason }
      });
      return;
    }

    const previousPermission = file.permission;
    file.permission = newPermission;
    await file.save();

    // Log with millisecond precision
    await AuditService.log({
      sessionId: session._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: eventType,
      resourceType: 'FILE',
      resourceId: file._id.toString(),
      metadata: {
        fileName: file.name,
        previousPermission,
        newPermission
      }
    });

    // Real-time broadcast
    await redisService.publish(`session:${session._id}:events`, {
      type: 'FILE_PERMISSION_CHANGED',
      sessionId: session._id.toString(),
      payload: {
        fileId: file._id.toString(),
        fileName: file.name,
        permission: newPermission,
        previousPermission,
        actorName: user.name
      }
    });

    res.status(200).json({
      success: true,
      data: file
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const lockFile = (req: AuthRequest, res: Response) =>
  setFilePermission(req, res, 'LOCKED', 'FILE_LOCKED');

export const unlockFile = (req: AuthRequest, res: Response) =>
  setFilePermission(req, res, 'VISIBLE_EDITABLE', 'FILE_UNLOCKED');

export const hideFile = (req: AuthRequest, res: Response) =>
  setFilePermission(req, res, 'HIDDEN', 'FILE_HIDDEN');

export const showFile = (req: AuthRequest, res: Response) =>
  setFilePermission(req, res, 'VISIBLE_READONLY', 'FILE_REVEALED');

export const makeFileReadonly = (req: AuthRequest, res: Response) =>
  setFilePermission(req, res, 'VISIBLE_READONLY', 'FILE_READONLY');

export const makeFileEditable = (req: AuthRequest, res: Response) =>
  setFilePermission(req, res, 'VISIBLE_EDITABLE', 'FILE_EDITABLE');

export const deleteFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const file = await File.findById(id);
    if (!file) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'File not found.' }
      });
      return;
    }

    const session = await Session.findById(file.sessionId);
    if (!session || !PermissionEngine.isInterviewerOrAdmin(user, session)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only interviewers can delete session files.' }
      });
      return;
    }

    await file.deleteOne();

    res.status(200).json({
      success: true,
      data: { message: 'File deleted.' }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};

export const getSessionFileStorage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } });
      return;
    }

    const isInterviewerOrAdmin = PermissionEngine.isInterviewerOrAdmin(user, session);
    const fileQuery: any = { sessionId };
    if (!isInterviewerOrAdmin) {
      fileQuery.permission = { $ne: 'HIDDEN' };
    }

    const files = await File.find(fileQuery).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        sessionId: session._id.toString(),
        sessionTitle: session.title,
        sessionCode: session.sessionCode,
        status: session.status,
        endedAt: session.endedAt,
        totalFiles: files.length,
        files: files.map((f) => ({
          id: f._id.toString(),
          name: f.name,
          language: f.language,
          content: f.content,
          permission: f.permission,
          sizeBytes: Buffer.byteLength(f.content || '', 'utf8'),
          lineCount: (f.content || '').split('\n').length,
          updatedAt: f.updatedAt,
          createdAt: f.createdAt
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};
