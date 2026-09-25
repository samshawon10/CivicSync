import { Router } from 'express';
import { createComment, createPost, deleteComment, deleteDraft, deletePost, getDraft, getMedia, getPost, listComments, listPosts, listSaved, react, saveDraft, submitModerationReport, toggleBlock, toggleFollow, toggleSave, updateComment, updatePost } from '../controllers/communityController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { uploadCommunityMedia } from '../middleware/uploadMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('citizen', 'admin'));
router.get('/posts', listPosts); router.post('/posts', uploadCommunityMedia, createPost);
router.get('/posts/:id', getPost); router.patch('/posts/:id', uploadCommunityMedia, updatePost); router.delete('/posts/:id', deletePost);
router.get('/posts/:id/media/:filename', getMedia); router.post('/posts/:id/reactions', react); router.post('/posts/:id/save', toggleSave);
router.get('/posts/:id/comments', listComments); router.post('/posts/:id/comments', createComment);
router.patch('/posts/:id/comments/:commentId', updateComment); router.delete('/posts/:id/comments/:commentId', deleteComment);
router.get('/saved', listSaved); router.get('/draft', getDraft); router.put('/draft', saveDraft); router.delete('/draft', deleteDraft);
router.post('/users/:id/follow', toggleFollow); router.post('/users/:id/block', toggleBlock); router.post('/reports', submitModerationReport);
export default router;
