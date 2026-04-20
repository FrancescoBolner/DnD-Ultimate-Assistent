import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './items.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.post('/campaign/:campaignId', requireDm(), ctrl.createHandler);

// Single item
router.get('/:id', requireCampaignScope('items'), ctrl.getHandler);
router.put('/:id', requireCampaignScope('items', 'dm'), ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('items', 'dm'), ctrl.deleteHandler);

export default router;
