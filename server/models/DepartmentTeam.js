import mongoose from 'mongoose';

const departmentTeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    departmentName: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: '' },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    skills: [{ type: String, trim: true }],
    serviceArea: { type: String, trim: true, default: '' },
    capacity: { type: Number, default: 5, min: 1, max: 50 },
    status: {
      type: String,
      enum: ['available', 'busy', 'on_break', 'off_duty', 'offline', 'maintenance'],
      default: 'available',
      index: true
    },
    currentLocation: {
      address: { type: String, trim: true, default: '' },
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null },
      updatedAt: { type: Date, default: null }
    },
    phone: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

departmentTeamSchema.index({ department: 1, status: 1 });
departmentTeamSchema.index({ departmentName: 1, name: 1 }, { unique: true });

export default mongoose.model('DepartmentTeam', departmentTeamSchema);
