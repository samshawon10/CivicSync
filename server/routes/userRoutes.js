import { Router } from 'express';
import { getMyProfile, getMyProfilePhoto, getUser, listUsers, updateMyPreferences, updateMyProfile, updateUserRole, updateUserStatus, uploadMyProfilePhoto } from '../controllers/userController.js';
import { uploadProfileImage } from '../middleware/uploadMiddleware.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/me', getMyProfile);
router.patch('/me', updateMyProfile);
router.get('/me/photo/:filename', getMyProfilePhoto);
router.post('/me/photo', uploadProfileImage, uploadMyProfilePhoto);
router.patch('/me/preferences', updateMyPreferences);
router.use(requireRole('admin'));
router.get('/', listUsers);
router.get('/:id', getUser);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);
export default router;

