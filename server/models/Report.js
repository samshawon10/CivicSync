import mongoose from 'mongoose';
import { reportCategories, reportDepartments, reportPriorities, reportStatuses } from '../config/reportOptions.js';
export { reportCategories, reportDepartments };

const reportSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  category: { type: String, required: true, enum: reportCategories },
  departmentName: { type: String, required: true, trim: true, enum: reportDepartments },
  priority: { type: String, enum: reportPriorities, default: 'medium' },
  location: { area: { type: String, trim: true, maxlength: 100, default: '' }, address: { type: String, trim: true, maxlength: 300, default: '' }, landmark: { type: String, trim: true, maxlength: 150, default: '' }, latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 } },
  additionalInfo: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: reportStatuses, default: 'pending' },
  assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  citizenResolution: { status: { type: String, enum: ['pending', 'confirmed', 'reopen_requested'], default: 'pending' }, note: { type: String, trim: true, maxlength: 500, default: '' }, requestedAt: { type: Date, default: null }, resolvedAt: { type: Date, default: null } },
  citizenFeedback: { rating: { type: Number, min: 1, max: 5, default: null }, comment: { type: String, trim: true, maxlength: 1000, default: '' }, submittedAt: { type: Date, default: null } },
  assignedFieldWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  // Connected Operations Engine extensions
  assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'DepartmentTeam', default: null, index: true },
  teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  activeTask: { type: mongoose.Schema.Types.ObjectId, ref: 'DepartmentTask', default: null },
  sla: {
    responseDueAt: { type: Date, default: null },
    arrivalDueAt: { type: Date, default: null },
    resolutionDueAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null }
  },
  escalation: {
    isEscalated: { type: Boolean, default: false, index: true },
    reason: { type: String, default: '' },
    escalatedAt: { type: Date, default: null },
    escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' }
  },
  handoverHistory: [
    {
      previousOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      newOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, default: '' },
      notes: { type: String, default: '' },
      transferredAt: { type: Date, default: Date.now }
    }
  ],
  messages: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      senderName: { type: String, default: '' },
      senderRole: { type: String, default: '' },
      text: { type: String, required: true, trim: true, maxlength: 1000 },
      isInternal: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  dueAt: { type: Date, default: null },
  completionReport: {
    summary: { type: String, trim: true, maxlength: 1200, default: '' },
    materials: { type: String, trim: true, maxlength: 800, default: '' },
    notes: { type: String, trim: true, maxlength: 800, default: '' },
    beforeImages: [{ type: String, trim: true }],
    afterImages: [{ type: String, trim: true }],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    verificationStatus: { type: String, enum: ['not_submitted', 'submitted', 'approved', 'rejected'], default: 'not_submitted' }
  },
  activity: [{ action: { type: String, required: true }, actorRole: { type: String, required: true }, timestamp: { type: Date, default: Date.now }, note: { type: String, maxlength: 500, default: '' } }],
  attachments: [{
    url: { type: String, required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    mediaType: { type: String, required: true, enum: ['image', 'video'] }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true });
reportSchema.index({ createdBy: 1, createdAt: -1 });
reportSchema.index({ createdBy: 1, status: 1 });
reportSchema.index({ departmentName: 1, status: 1, priority: 1, updatedAt: -1 });

export default mongoose.model('Report', reportSchema);

