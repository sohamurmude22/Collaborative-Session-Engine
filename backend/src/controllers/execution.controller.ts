import { Response } from 'express';
import { Session } from '../models/Session.js';
import { File } from '../models/File.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { PermissionEngine } from '../permissions/PermissionEngine.js';
import { CodeExecutionService } from '../services/execution.service.js';
import { AuditService } from '../audit/AuditService.js';
import { redisService } from '../services/redis.service.js';
import { ProgrammingLanguage } from '../types/cse.js';

export const runCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const sessionId = String(req.params.sessionId);
    const { fileId, code, language, stdinInput } = req.body;

    if (!sessionId || sessionId === 'direct') {
      const result = await CodeExecutionService.execute(
        language || 'cpp',
        code || '',
        stdinInput || '',
        8000
      );
      res.status(200).json({ success: true, data: result });
      return;
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found.' }
      });
      return;
    }

    const check = PermissionEngine.canRunCode(user, session);
    if (!check.allowed) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: check.reason }
      });
      return;
    }

    let sourceCode = code;
    let targetLanguage: ProgrammingLanguage = language || 'cpp';
    let targetFileName = 'main.cpp';

    if (fileId) {
      const file = await File.findById(fileId);
      if (file) {
        // Must be allowed to view file to run it
        const viewCheck = PermissionEngine.canViewFile(user, session, file);
        if (!viewCheck.allowed) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: viewCheck.reason }
          });
          return;
        }
        targetFileName = file.name;
        if (!sourceCode) {
          sourceCode = file.content;
        }
        targetLanguage = file.language;
      }
    }

    if (!sourceCode) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Source code is required to execute.' }
      });
      return;
    }

    // Load visible companion files from this session so multi-file C++ works (e.g. solution.cpp, utils.h)
    const isInterviewer = PermissionEngine.isInterviewerOrAdmin(user, session);
    const fileFilter: any = { sessionId };
    if (!isInterviewer) {
      fileFilter.permission = { $ne: 'HIDDEN' };
    }
    const allFiles = await File.find(fileFilter).lean();
    const extraFiles = allFiles
      .filter((f) => (fileId ? f._id.toString() !== fileId : f.name !== targetFileName))
      .map((f) => ({ name: f.name, content: f.content }));

    // Execute through sandbox C++ / Python runner
    const result = await CodeExecutionService.execute(
      targetLanguage,
      sourceCode,
      stdinInput || '',
      8000,
      targetFileName,
      extraFiles
    );

    // Audit log code execution
    await AuditService.log({
      sessionId,
      actorId: user._id.toString(),
      actorName: user.name,
      actorRole: user.role,
      eventType: 'CODE_RUN',
      resourceType: 'CODE',
      resourceId: fileId,
      metadata: {
        language: targetLanguage,
        status: result.status,
        executionTime: result.executionTime,
        exitCode: result.exitCode
      }
    });

    // Broadcast code execution result to all participants in session
    await redisService.publish(`session:${sessionId}:events`, {
      type: 'CODE_EXECUTED',
      sessionId,
      payload: {
        actorId: user._id.toString(),
        actorName: user.name,
        actorRole: user.role,
        fileId,
        fileName: targetFileName,
        result
      }
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
};
