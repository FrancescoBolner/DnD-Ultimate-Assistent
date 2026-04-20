import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from './auth.controller';
import { requireAuth } from '../core/middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);

// Protected routes
router.get('/me', requireAuth, meHandler);

export default router;
