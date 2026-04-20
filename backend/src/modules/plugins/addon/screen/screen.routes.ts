import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './screen.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped
router.get('/campaign/:campaignId',         requireCampaignMember(), ctrl.listHandler);
router.get('/campaign/:campaignId/active',  requireCampaignMember(), ctrl.activeHandler);
router.post('/campaign/:campaignId',        requireDm(),             ctrl.createHandler);
router.post('/campaign/:campaignId/push',   requireDm(),             ctrl.pushHandler);
router.delete('/campaign/:campaignId/active', requireDm(),           ctrl.stopHandler);

// Single screen
router.get('/:id',    requireCampaignScope('screen'),        ctrl.getHandler);
router.put('/:id',    requireCampaignScope('screen', 'dm'),  ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('screen', 'dm'),  ctrl.deleteHandler);

// Screen presets
router.get('/campaign/:campaignId/presets',              requireCampaignMember(), ctrl.listPresetsHandler);
router.post('/campaign/:campaignId/presets',             requireDm(),             ctrl.savePresetHandler);
router.put('/campaign/:campaignId/presets/:presetId',    requireDm(),             ctrl.updatePresetHandler);
router.delete('/campaign/:campaignId/presets/:presetId', requireDm(),             ctrl.deletePresetHandler);

export default router;
