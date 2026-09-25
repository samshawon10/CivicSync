import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
  relatedType: { type: String, enum: ['report', 'emergency', 'department', 'user', 'community', 'civic_service', 'civic_alert', 'civic_feedback', 'civic_verification', 'community_group', 'volunteer', 'system'], default: 'system' },
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
  message: { type: String, required: true, trim: true, maxlength: 300 },
  type: { type: String, enum: ['report_status', 'community', 'civic_alert', 'civic_service', 'civic_feedback', 'civic_verification', 'community_group', 'volunteer', 'system'], default: 'report_status' },
  readAt: { type: Date, default: null }
}, { timestamps: true });
notificationSchema.index({ recipient: 1, createdAt: -1 });
export default mongoose.model('Notification', notificationSchema);
