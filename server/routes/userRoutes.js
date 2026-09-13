import { Router } from 'express';
import { getUser, listUsers, updateUserRole, updateUserStatus } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);
export default router;

