import mongoose from 'mongoose';

const emergencyAlertSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  category: { type: String, trim: true, default: 'public_safety' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  location: { address: { type: String, default: '' }, latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 } },
  active: { type: Boolean, default: true }
}, { timestamps: true });
emergencyAlertSchema.index({ active: 1, createdAt: -1 });
emergencyAlertSchema.index({ category: 1, createdAt: -1 });
export default mongoose.model('EmergencyAlert', emergencyAlertSchema);
