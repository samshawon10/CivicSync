import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { globalSearch, listSearchCategories, searchSuggest } from '../controllers/searchController.js';

const router = Router();

// Any authenticated role may call search; authorization is enforced per
// category inside the controller/service, not by a route-level role list.
router.use(requireAuth);
router.get('/', globalSearch);
router.get('/suggest', searchSuggest);
router.get('/categories', listSearchCategories);

export default router;
