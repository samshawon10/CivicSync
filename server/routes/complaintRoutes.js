import { Router } from 'express';
import { createComplaint, deleteComplaint, getComplaint, listComplaints, updateComplaint } from '../controllers/complaintController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);
router.route('/').post(createComplaint).get(listComplaints);
router.route('/:id').get(getComplaint).put(updateComplaint).delete(deleteComplaint);
export default router;

