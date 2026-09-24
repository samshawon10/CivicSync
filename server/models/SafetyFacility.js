import mongoose from 'mongoose';
import { facilityTypes } from '../config/facilityOptions.js';

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: undefined }
}, { _id: false });

const safetyFacilitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  type: { type: String, enum: facilityTypes, required: true, index: true },
  address: { type: String, trim: true, maxlength: 300, default: '' },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  // GeoJSON is populated for new/updated rows. Legacy latitude/longitude fields
  // remain so existing records and clients continue to work during migration.
  location: { type: pointSchema, default: undefined },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  emergencyPhone: { type: String, trim: true, maxlength: 30, default: '' },
  email: { type: String, trim: true, maxlength: 120, default: '' },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  openingHours: { type: String, trim: true, maxlength: 160, default: '' },
  emergencyServiceAvailable: { type: Boolean, default: true },
  status: { type: String, enum: ['operational', 'degraded', 'offline'], default: 'operational', index: true },
  available: { type: Boolean, default: true },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

safetyFacilitySchema.index({ type: 1, active: 1 });
safetyFacilitySchema.index({ location: '2dsphere' }, { sparse: true });
export default mongoose.model('SafetyFacility', safetyFacilitySchema);