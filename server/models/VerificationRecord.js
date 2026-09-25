import mongoose from 'mongoose';

const verificationRecordSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: ['official_announcement', 'verified_org', 'verified_group', 'verified_contributor', 'confirmed_civic_info'],
    required: true,
    index: true
  },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  verificationType: {
    type: String,
    enum: ['official_announcement', 'verified_org', 'verified_group', 'verified_contributor', 'confirmed_civic_info'],
    required: true
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

verificationRecordSchema.index({ targetType: 1, targetId: 1, status: 1 });

export default mongoose.model('VerificationRecord', verificationRecordSchema);
