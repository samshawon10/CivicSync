import { Router } from 'express';
import { exchangeFirebaseIdentity, logout, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';

const router = Router();
router.post('/firebase', requireFirebaseAuth, exchangeFirebaseIdentity);
router.post('/register', requireFirebaseAuth, exchangeFirebaseIdentity);
router.post('/login', requireFirebaseAuth, exchangeFirebaseIdentity);
router.get('/me', requireAuth, me);
router.post('/logout', logout);
export default router;
