import mongoose from 'mongoose';

const civicFeedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetType: { type: String, enum: ['report', 'service', 'emergency'], default: 'report', index: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  aspectRatings: {
    resolutionQuality: { type: Number, min: 1, max: 5, default: null },
    communicationQuality: { type: Number, min: 1, max: 5, default: null },
    timeliness: { type: Number, min: 1, max: 5, default: null }
  },
  comment: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });

civicFeedbackSchema.index({ targetType: 1, targetId: 1 });
civicFeedbackSchema.index({ user: 1, targetId: 1 });

export default mongoose.model('CivicFeedback', civicFeedbackSchema);
