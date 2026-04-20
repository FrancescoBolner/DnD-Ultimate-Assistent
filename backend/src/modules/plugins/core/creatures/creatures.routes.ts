import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './creatures.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.post('/campaign/:campaignId', requireDm(), ctrl.createHandler);

// Single creature
router.get('/:id', requireCampaignScope('creatures'), ctrl.getHandler);
router.put('/:id', requireCampaignScope('creatures', 'dm'), ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('creatures', 'dm'), ctrl.deleteHandler);

export default router;
