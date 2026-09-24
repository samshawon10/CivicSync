import mongoose from 'mongoose';

const responseTeamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
  type: { type: String, enum: ['medical', 'fire', 'security', 'traffic', 'disaster', 'rescue', 'infrastructure', 'other'], required: true, index: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  members: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, role: { type: String, default: '' } }],
  baseLocation: { address: { type: String, trim: true, maxlength: 300, default: '' }, latitude: { type: Number, min: -90, max: 90, default: null }, longitude: { type: Number, min: -180, max: 180, default: null } },
  availability: { type: String, enum: ['available', 'busy', 'offline'], default: 'available', index: true },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

responseTeamSchema.index({ type: 1, availability: 1, active: 1 });
export default mongoose.model('ResponseTeam', responseTeamSchema);