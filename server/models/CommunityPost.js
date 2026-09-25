import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({ filename: { type: String, required: true }, originalName: { type: String, required: true }, mimeType: { type: String, required: true }, size: { type: Number, required: true }, mediaType: { type: String, enum: ['image', 'video'], required: true } }, { _id: false });
const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, trim: true, maxlength: 3000, default: '' }, media: [mediaSchema],
  category: { type: String, enum: ['general', 'local_issue', 'safety', 'emergency_awareness', 'community_help', 'lost_found', 'event', 'announcement', 'discussion'], default: 'general', index: true },
  hashtags: [{ type: String, lowercase: true, trim: true }], mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  location: { area: { type: String, trim: true, maxlength: 100, default: '' }, label: { type: String, trim: true, maxlength: 140, default: '' } },
  visibility: { type: String, enum: ['public', 'community', 'followers'], default: 'community', index: true },
  originalPost: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', default: null },
  status: { type: String, enum: ['published', 'hidden', 'removed'], default: 'published', index: true },
  reactionCount: { type: Number, default: 0, min: 0 }, commentCount: { type: Number, default: 0, min: 0 }, shareCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });
postSchema.index({ status: 1, visibility: 1, createdAt: -1 });
postSchema.index({ hashtags: 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
export default mongoose.model('CommunityPost', postSchema);
