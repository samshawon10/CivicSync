import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { archiveService, createCategory, createService, getService, listCategories, listSavedServices, listServices, publishService, serviceRequestPrefill, toggleSaveService, updateService } from '../controllers/civicServiceController.js';

const router = Router();

router.use(requireAuth);
// Catalogue writes are Super Admin only (config/permissions.js -> 'services');
// every authenticated role may read published service information.
router.get('/categories', listCategories);
router.post('/categories', requireRole('admin'), createCategory);
router.get('/saved', listSavedServices);
router.get('/', listServices);
router.post('/', requireRole('admin'), createService);
router.get('/:id', getService);
router.patch('/:id', requireRole('admin'), updateService);
router.post('/:id/publish', requireRole('admin'), publishService);
router.post('/:id/archive', requireRole('admin'), archiveService);
router.post('/:id/save', toggleSaveService);
router.get('/:id/request-prefill', serviceRequestPrefill);

export default router;
