import mongoose from 'mongoose';

const emergencyResponderLocationSchema = new mongoose.Schema({
  emergency: { type: mongoose.Schema.Types.ObjectId, ref: 'Emergency', required: true, index: true },
  responder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyResponseAssignment', default: null },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number, min: 0, default: null },
  recordedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });
emergencyResponderLocationSchema.index({ emergency: 1, responder: 1 }, { unique: true });
export default mongoose.model('EmergencyResponderLocation', emergencyResponderLocationSchema);
