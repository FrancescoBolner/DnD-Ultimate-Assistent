import { Router } from 'express';
import { requireAuth } from '../../../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm, requireCampaignScope } from '../../../../core/middleware/rbac.middleware';
import * as ctrl from './combat.controller';

const router = Router();
router.use(requireAuth);

// Campaign-scoped
router.get('/campaign/:campaignId', requireCampaignMember(), ctrl.listHandler);
router.get('/campaign/:campaignId/active', requireCampaignMember(), ctrl.activeHandler);
router.post('/campaign/:campaignId', requireDm(), ctrl.createHandler);
router.post('/campaign/:campaignId/start', requireDm(), ctrl.startHandler);

// Single combat (campaign membership resolved from combat entity)
router.get('/:id', requireCampaignScope('combat'), ctrl.getHandler);
router.put('/:id', requireCampaignScope('combat', 'dm'), ctrl.updateHandler);
router.delete('/:id', requireCampaignScope('combat', 'dm'), ctrl.deleteHandler);
router.post('/:id/next', requireCampaignScope('combat', 'dm'), ctrl.nextTurnHandler);

// Participants (campaign membership resolved from parent combat)
router.get('/:id/participants', requireCampaignScope('combat'), ctrl.participantsHandler);
router.post('/:id/participants', requireCampaignScope('combat', 'dm'), ctrl.addParticipantHandler);
router.put('/:id/participants/:participantId', requireCampaignScope('combat'), ctrl.updateParticipantHandler);
router.delete('/:id/participants/:participantId', requireCampaignScope('combat', 'dm'), ctrl.removeParticipantHandler);
router.post('/:id/participants/:participantId/effects', requireCampaignScope('combat', 'dm'), ctrl.applyEffectHandler);
router.put('/:id/participants/:participantId/effects/:effectId', requireCampaignScope('combat', 'dm'), ctrl.updateEffectHandler);
router.delete('/:id/participants/:participantId/effects/:effectId', requireCampaignScope('combat', 'dm'), ctrl.removeEffectHandler);

export default router;
