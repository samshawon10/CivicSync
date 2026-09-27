import mongoose from 'mongoose';

const reportCategorySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 60,
      match: /^[a-z0-9_]+$/,
      message: 'Category keys may only contain lowercase letters, numbers and underscores.'
    },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    
    defaultDepartment: { type: String, trim: true, maxlength: 120, default: '' },
    order: { type: Number, default: 500, index: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

reportCategorySchema.index({ active: 1, order: 1 });

export default mongoose.model('ReportCategory', reportCategorySchema);