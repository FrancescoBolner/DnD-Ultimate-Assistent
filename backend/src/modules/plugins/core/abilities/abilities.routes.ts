import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './abilities.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.post('/campaign/:campaignId', requireDm(), ctrl.createHandler);

// Owner-based listing (campaign membership checked via owner entity)
router.get('/owner/:ownerType/:ownerId', ctrl.listByOwnerHandler);

// Single ability
router.get('/:id', requireCampaignScope('abilities'), ctrl.getHandler);
router.put('/:id', requireCampaignScope('abilities', 'dm'), ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('abilities', 'dm'), ctrl.deleteHandler);

export default router;
