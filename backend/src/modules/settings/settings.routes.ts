import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm } from '../../core/middleware/rbac.middleware';
import {
  getUserSettingsHandler,
  updateUserSettingsHandler,
  getCampaignSettingsHandler,
  updateCampaignSettingsHandler,
  updateCampaignPluginsHandler,
} from './settings.controller';

const router = Router();

router.use(requireAuth);

/* ── User settings (user-scoped, no campaign RBAC) ── */
router.get('/user', getUserSettingsHandler);
router.put('/user', updateUserSettingsHandler);

/* ── Campaign settings ── */
router.get('/campaign/:id', requireCampaignMember(undefined, 'id'), getCampaignSettingsHandler);
router.put('/campaign/:id', requireDm('id'), updateCampaignSettingsHandler);
router.put('/campaign/:id/plugins', requireDm('id'), updateCampaignPluginsHandler);

export default router;
