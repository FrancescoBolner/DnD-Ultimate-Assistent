import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './soundboard.controller';

const router = Router();
router.use(requireAuth);

/* Campaign-scoped */
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.post('/campaign/:campaignId', requireCampaignMember(), ctrl.createHandler);

/* Single sound (campaign scope resolved from entity; any member allowed — UI enforces canManage) */
router.put('/:id', requireCampaignScope('soundboard_sounds'), ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('soundboard_sounds'), ctrl.deleteHandler);

export default router;
