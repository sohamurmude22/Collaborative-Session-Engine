import { Router } from 'express';
import {
  revealQuestion,
  updateQuestion,
  deleteQuestion,
  createHint,
  revealHint,
  createTestCase,
  revealTestCase
} from '../controllers/question.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

// Question routes
router.put('/questions/:id', updateQuestion);
router.delete('/questions/:id', deleteQuestion);
router.post('/questions/:id/reveal', revealQuestion);

// Hints subresource & reveal
router.post('/questions/:id/hints', createHint);
router.post('/hints/:id/reveal', revealHint);

// Testcases subresource & reveal
router.post('/questions/:id/testcases', createTestCase);
router.post('/testcases/:id/reveal', revealTestCase);

export default router;
