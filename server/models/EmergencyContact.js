import mongoose from 'mongoose';

const emergencyContactSchema = new mongoose.Schema({
  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  relationship: { type: String, trim: true, maxlength: 60, default: '' },
  enabledForSos: { type: Boolean, default: true }
}, { timestamps: true });
emergencyContactSchema.index({ citizen: 1, createdAt: -1 });
export default mongoose.model('EmergencyContact', emergencyContactSchema);
