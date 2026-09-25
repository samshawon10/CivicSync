import mongoose from 'mongoose';
const schema = new mongoose.Schema({ author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, content: { type: String, trim: true, maxlength: 3000, default: '' }, category: { type: String, default: 'general' }, visibility: { type: String, default: 'community' }, location: { area: { type: String, default: '' }, label: { type: String, default: '' } } }, { timestamps: true });
export default mongoose.model('CommunityDraft', schema);
