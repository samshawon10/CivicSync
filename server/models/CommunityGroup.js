import mongoose from 'mongoose';

const communityGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  coverImage: { type: String, default: '' },
  category: {
    type: String,
    enum: ['neighborhood', 'safety', 'volunteer', 'local_issues', 'interest', 'event'],
    default: 'neighborhood',
    index: true
  },
  privacy: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  rules: [{ type: String, trim: true, maxlength: 300 }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'moderator', 'admin'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  memberCount: { type: Number, default: 1 },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true }
}, { timestamps: true });

communityGroupSchema.index({ category: 1, status: 1 });
communityGroupSchema.index({ 'members.user': 1 });

export default mongoose.model('CommunityGroup', communityGroupSchema);
