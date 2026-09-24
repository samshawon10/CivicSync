import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
    type: { type: String, trim: true, maxlength: 80, default: '' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    contactNumber: { type: String, trim: true, maxlength: 30, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    scope: { type: String, enum: ['civic', 'emergency', 'hybrid'], default: 'civic', index: true },
    emergencyTypes: [{ type: String, enum: ['police', 'fire', 'medical', 'accident', 'disaster', 'other'] }],
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    emergencyHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

departmentSchema.index({ head: 1 }, { unique: true, sparse: true });
departmentSchema.index({ emergencyHead: 1 }, { unique: true, sparse: true });
departmentSchema.index({ emergencyTypes: 1, status: 1 });

export default mongoose.model('Department', departmentSchema);
