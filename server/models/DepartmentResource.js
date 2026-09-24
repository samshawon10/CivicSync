import mongoose from 'mongoose';

const departmentResourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ['vehicle', 'equipment', 'specialist', 'personnel', 'emergency_supplies'],
      required: true,
      index: true
    },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    departmentName: { type: String, required: true, trim: true, index: true },
    identifier: { type: String, trim: true, default: '' },
    capacityOrQuantity: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['available', 'reserved', 'assigned', 'in_use', 'maintenance', 'unavailable'],
      default: 'available',
      index: true
    },
    assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'DepartmentTeam', default: null },
    assignedCase: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
    requests: [
      {
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        requesterRole: { type: String, default: '' },
        caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
        reason: { type: String, default: '' },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now },
        reviewedAt: { type: Date, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reviewNote: { type: String, default: '' }
      }
    ],
    notes: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

departmentResourceSchema.index({ departmentName: 1, status: 1 });
export default mongoose.model('DepartmentResource', departmentResourceSchema);
