import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './effects.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.post('/campaign/:campaignId', requireDm(), ctrl.createHandler);

// Single effect (handles global effects with NULL campaign_id)
router.get('/:id', requireCampaignScope('effects'), ctrl.getHandler);
router.put('/:id', requireCampaignScope('effects', 'dm'), ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('effects', 'dm'), ctrl.deleteHandler);

export default router;
