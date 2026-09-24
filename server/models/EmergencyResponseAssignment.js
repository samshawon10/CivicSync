import mongoose from 'mongoose';

const emergencyResponseAssignmentSchema = new mongoose.Schema({
  emergency: { type: mongoose.Schema.Types.ObjectId, ref: 'Emergency', required: true, index: true },
  responseType: { type: String, required: true, trim: true, maxlength: 80 },
  responseTeam: { type: String, trim: true, maxlength: 120, default: '' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'ResponseTeam', default: null },
  emergencyOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  fieldWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  status: { type: String, enum: ['assigned', 'accepted', 'en_route', 'on_scene', 'responding', 'completed', 'cancelled'], default: 'assigned', index: true },
  etaMinutes: { type: Number, min: 0, default: null },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  assignedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date, default: null },
  arrivedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

emergencyResponseAssignmentSchema.index({ emergency: 1, status: 1 });
emergencyResponseAssignmentSchema.index({ emergencyOfficer: 1, status: 1, updatedAt: -1 });
emergencyResponseAssignmentSchema.index({ fieldWorkers: 1, status: 1, updatedAt: -1 });
export default mongoose.model('EmergencyResponseAssignment', emergencyResponseAssignmentSchema);
