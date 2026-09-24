import mongoose from 'mongoose';

const emergencyAlertSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  category: { type: String, trim: true, default: 'public_safety' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['draft', 'scheduled', 'active', 'expired', 'cancelled'], default: 'active', index: true },
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
  affectedArea: { type: String, trim: true, maxlength: 160, default: '' },
  radiusKm: { type: Number, min: 0.1, max: 100, default: null },
  location: { address: { type: String, default: '' }, latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 } },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
emergencyAlertSchema.index({ active: 1, createdAt: -1 });
emergencyAlertSchema.index({ category: 1, createdAt: -1 });
export default mongoose.model('EmergencyAlert', emergencyAlertSchema);
