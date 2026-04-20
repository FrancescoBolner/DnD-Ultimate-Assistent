import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth.middleware';
import { updateMeHandler, deleteMeHandler } from './users.controller';

const router = Router();

router.put('/me', requireAuth, updateMeHandler);
router.delete('/me', requireAuth, deleteMeHandler);

export default router;
