import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import { assignHandler, assignPlayerHandler, updateHandler, deleteHandler } from './characters.controller';

const router = Router();

router.use(requireAuth);

router.patch('/:id/assign', assignHandler);
router.patch('/:id/assign-player', requireCampaignScope('characters', 'dm'), assignPlayerHandler);
router.put('/:id', updateHandler);
router.delete('/:id', deleteHandler);

export default router;
