import { Router } from 'express';
import {
  getFriends,
  searchUsers,
  addFriend,
  removeFriend,
  startSessionWithFriend
} from '../controllers/friend.controller.js';
import { authenticateUser } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.get('/', getFriends);
router.get('/search', searchUsers);
router.post('/add', addFriend);
router.delete('/:id', removeFriend);
router.post('/start-session', startSessionWithFriend);

export default router;
