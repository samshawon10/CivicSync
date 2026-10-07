import { Router } from 'express';
import { getMyProfile, getMyProfilePhoto, getUser, listUsers, updateMyPreferences, updateMyProfile, uploadMyProfilePhoto } from '../controllers/userController.js';
import { uploadProfileImage } from '../middleware/uploadMiddleware.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { updateUserRole as manageUserRole, updateUserStatus as manageUserStatus } from '../controllers/adminController.js';

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
router.patch('/:id/role', manageUserRole);
router.patch('/:id/status', manageUserStatus);
export default router;

