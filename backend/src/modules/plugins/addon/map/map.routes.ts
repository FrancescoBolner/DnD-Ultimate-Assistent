import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './map.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.post('/campaign/:campaignId', requireDm(), ctrl.createHandler);

// Single map
router.get('/:id', requireCampaignScope('map'), ctrl.getHandler);
router.put('/:id', requireCampaignScope('map', 'dm'), ctrl.updateHandler);
router.put('/:id/view-state', requireCampaignScope('map', 'dm'), ctrl.updateViewStateHandler);
router.delete('/:id', requireCampaignScope('map', 'dm'), ctrl.deleteHandler);

// Map entities
router.get('/:id/entities', requireCampaignScope('map'), ctrl.listEntitiesHandler);
router.post('/:id/entities', requireCampaignScope('map', 'dm'), ctrl.createEntityHandler);
router.put('/:id/entities/:entityId', requireCampaignScope('map'), ctrl.updateEntityHandler);
router.delete('/:id/entities/:entityId', requireCampaignScope('map', 'dm'), ctrl.deleteEntityHandler);

// Range marks
router.get('/:id/range-marks', requireCampaignScope('map'), ctrl.listRangeMarksHandler);
router.post('/:id/range-marks', requireCampaignScope('map', 'dm'), ctrl.createRangeMarkHandler);
router.put('/:id/range-marks/:markId', requireCampaignScope('map', 'dm'), ctrl.updateRangeMarkHandler);
router.delete('/:id/range-marks/:markId', requireCampaignScope('map', 'dm'), ctrl.deleteRangeMarkHandler);

export default router;
