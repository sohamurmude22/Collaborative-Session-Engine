import { Router } from 'express';
import {
  createSession,
  getSessions,
  getSessionById,
  getSessionByCode,
  startSession,
  pauseSession,
  endSession,
  deleteSession,
  getUsersList,
  addParticipant,
  toggleMasterLock,
  leaveSession,
  issueWarning,
  blockUser,
  unblockUser,
  lockScreen,
  unlockScreen,
  resetSystemDatabase
} from '../controllers/session.controller.js';
import {
  getFiles,
  createFile,
  getSessionFileStorage
} from '../controllers/file.controller.js';
import {
  getQuestions,
  createQuestion
} from '../controllers/question.controller.js';
import {
  getSessionAuditLogs,
  getSessionTimeline
} from '../controllers/audit.controller.js';
import { runCode } from '../controllers/execution.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.post('/', createSession);
router.get('/', getSessions);
router.get('/users/list', getUsersList);
router.post('/reset-system-database', resetSystemDatabase);
router.get('/code/:code', getSessionByCode);
router.get('/:id', getSessionById);
router.delete('/:id', deleteSession);
router.post('/:id/participants', addParticipant);

// Lifecycle & Controls
router.post('/:id/start', startSession);
router.post('/:id/pause', pauseSession);
router.post('/:id/end', endSession);
router.post('/:id/leave', leaveSession);
router.post('/:id/warning', issueWarning);
router.post('/:id/block', blockUser);
router.post('/:id/unblock', unblockUser);
router.post('/:id/lock-screen', lockScreen);
router.post('/:id/unlock-screen', unlockScreen);
router.post('/:id/master-lock', toggleMasterLock);


// Files & Storage subresource
router.get('/:sessionId/files', getFiles);
router.get('/:sessionId/storage', getSessionFileStorage);
router.post('/:sessionId/files', createFile);

// Questions subresource
router.get('/:sessionId/questions', getQuestions);
router.post('/:sessionId/questions', createQuestion);

// Audit & Timeline
router.get('/:sessionId/audit', getSessionAuditLogs);
router.get('/:sessionId/timeline', getSessionTimeline);

// Code Execution
router.post('/execute-direct', runCode);
router.post('/:sessionId/execute', runCode);

export default router;
