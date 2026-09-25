import mongoose from 'mongoose';

/** Service categories are admin-governed so the catalogue never invents data. */
const schema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, lowercase: true, unique: true },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  icon: { type: String, trim: true, maxlength: 40, default: 'fileText' },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
schema.index({ active: 1, order: 1 });
export default mongoose.model('CivicServiceCategory', schema);
