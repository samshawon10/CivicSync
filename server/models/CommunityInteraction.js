import mongoose from 'mongoose';
const schema = new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, targetType: { type: String, enum: ['post', 'user'], required: true }, target: { type: mongoose.Schema.Types.ObjectId, required: true }, kind: { type: String, enum: ['like', 'helpful', 'support', 'concern', 'celebrate', 'save', 'follow', 'block'], required: true } }, { timestamps: true });
schema.index({ actor: 1, targetType: 1, target: 1, kind: 1 }, { unique: true });
schema.index({ target: 1, kind: 1, createdAt: -1 });
export default mongoose.model('CommunityInteraction', schema);
