import mongoose from 'mongoose';

const safetyFacilitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  type: { type: String, enum: ['hospital', 'police', 'fire_station', 'ambulance', 'shelter', 'safe_point'], required: true, index: true },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  available: { type: Boolean, default: true },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

safetyFacilitySchema.index({ type: 1, active: 1 });
export default mongoose.model('SafetyFacility', safetyFacilitySchema);