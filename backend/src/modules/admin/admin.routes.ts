import { Router } from 'express';
import { requireAuth } from '../../core/middleware/auth.middleware';
import { requireAdmin } from '../../core/middleware/rbac.middleware';
import * as ctrl from './admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireAdmin);

router.get('/stats', ctrl.getStats);
router.get('/users', ctrl.getUsers);
router.patch('/users/:userId/active', ctrl.toggleUserActive);
router.patch('/users/:userId/admin', ctrl.toggleUserAdmin);
router.get('/campaigns', ctrl.getCampaigns);
router.get('/images', ctrl.getImages);
router.get('/db/export', ctrl.exportDb);
router.post('/db/import', ctrl.importDb);

export default router;
