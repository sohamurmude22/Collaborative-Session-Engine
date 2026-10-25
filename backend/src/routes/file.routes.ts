import { Router } from 'express';
import {
  getFileById,
  updateFile,
  renameFile,
  lockFile,
  unlockFile,
  hideFile,
  showFile,
  makeFileReadonly,
  makeFileEditable,
  deleteFile
} from '../controllers/file.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.get('/:id', getFileById);
router.patch('/:id', updateFile);
router.patch('/:id/rename', renameFile);
router.put('/:id/rename', renameFile);
router.delete('/:id', deleteFile);

// Dynamic Permission endpoints
router.post('/:id/lock', lockFile);
router.post('/:id/unlock', unlockFile);
router.post('/:id/hide', hideFile);
router.post('/:id/show', showFile);
router.post('/:id/readonly', makeFileReadonly);
router.post('/:id/editable', makeFileEditable);

export default router;
