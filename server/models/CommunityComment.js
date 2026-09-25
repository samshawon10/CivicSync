import mongoose from 'mongoose';
const schema = new mongoose.Schema({ post: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true }, author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, parent: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityComment', default: null, index: true }, content: { type: String, required: true, trim: true, minlength: 1, maxlength: 1500 }, mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], editedAt: { type: Date, default: null }, status: { type: String, enum: ['published', 'hidden', 'removed'], default: 'published' } }, { timestamps: true });
schema.index({ post: 1, parent: 1, createdAt: -1 });
export default mongoose.model('CommunityComment', schema);
