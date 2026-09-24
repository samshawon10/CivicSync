import mongoose from 'mongoose';

const emergencyCategorySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9_]+$/ },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  subcategories: [{ key: { type: String, trim: true, maxlength: 80 }, label: { type: String, trim: true, maxlength: 100 }, active: { type: Boolean, default: true } }],
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
export default mongoose.model('EmergencyCategory', emergencyCategorySchema);
