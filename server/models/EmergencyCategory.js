import mongoose from 'mongoose';

const emergencyCategorySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9_]+$/ },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  icon: { type: String, trim: true, maxlength: 60, default: 'siren' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
  color: { type: String, trim: true, maxlength: 7, default: '#2563eb' },
  subcategories: [{ key: { type: String, trim: true, maxlength: 80 }, label: { type: String, trim: true, maxlength: 100 }, active: { type: Boolean, default: true } }],
  responseTargetMinutes: { type: Number, min: 1, max: 1440, default: 30 },
  responseWarningMinutes: { type: Number, min: 1, max: 1440, default: 20 },
  responseCriticalMinutes: { type: Number, min: 1, max: 1440, default: 30 },
  responseTimeActive: { type: Boolean, default: true, index: true },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
export default mongoose.model('EmergencyCategory', emergencyCategorySchema);
