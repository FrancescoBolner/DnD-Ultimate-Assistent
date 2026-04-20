import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth.middleware';
import { requireCampaignMember, requireDm } from '../../core/middleware/rbac.middleware';
import {
  listHandler,
  createHandler,
  joinHandler,
  leaveHandler,
  membersHandler,
  getPlayersHandler,
  charactersHandler,
  createCharacterHandler,
  updateHandler,
  deleteHandler,
  kickPlayerHandler,
  banPlayerHandler,
  acceptPlayerHandler,
  rejectPlayerHandler,
  unbanPlayerHandler,
  deletePlayerEntryHandler,
  reinvitePlayerHandler,
  regenerateInviteCodeHandler,
  transferOwnershipHandler,
} from './campaigns.controller';

const router = Router();

router.use(requireAuth);

// User-scoped (list own campaigns, create new, join by code)
router.get('/', listHandler);
router.post('/', createHandler);
router.post('/join', joinHandler);

// DM-only campaign management
router.put('/:id', requireDm('id'), updateHandler);
router.delete('/:id', requireDm('id'), deleteHandler);
router.post('/:id/invite-code', requireDm('id'), regenerateInviteCodeHandler);
router.post('/:id/transfer', requireDm('id'), transferOwnershipHandler);

// Member-scoped
router.delete('/:id/leave', requireCampaignMember(undefined, 'id'), leaveHandler);
router.get('/:id/members', requireCampaignMember(undefined, 'id'), membersHandler);
router.get('/:id/characters', requireCampaignMember(undefined, 'id'), charactersHandler);
router.post('/:id/characters', requireCampaignMember(undefined, 'id'), createCharacterHandler);

// DM-only player management
router.get('/:id/players', requireDm('id'), getPlayersHandler);
router.delete('/:id/members/:userId', requireDm('id'), kickPlayerHandler);
router.post('/:id/members/:userId/ban', requireDm('id'), banPlayerHandler);
router.post('/:id/members/:userId/accept', requireDm('id'), acceptPlayerHandler);
router.delete('/:id/members/:userId/reject', requireDm('id'), rejectPlayerHandler);
router.post('/:id/members/:userId/unban', requireDm('id'), unbanPlayerHandler);
router.delete('/:id/members/:userId/entry', requireDm('id'), deletePlayerEntryHandler);
router.post('/:id/members/:userId/reinvite', requireDm('id'), reinvitePlayerHandler);

export default router;
