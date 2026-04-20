import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './notes.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped (any member can create/view notes; service handles privacy)
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.post('/campaign/:campaignId', requireCampaignMember(), ctrl.createHandler);

// Single note (any member can access; controller enforces ownership for edits)
router.get('/:id', requireCampaignScope('notes'), ctrl.getHandler);
router.put('/:id', requireCampaignScope('notes'), ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('notes'), ctrl.deleteHandler);

export default router;
