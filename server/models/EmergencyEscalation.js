import mongoose from 'mongoose';
import { WORKFLOW_STATUSES } from '../config/emergencyOps.js';

const escalationSchema = new mongoose.Schema(
  {
    emergency: { type: mongoose.Schema.Types.ObjectId, ref: 'Emergency', required: true, index: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    raisedByRole: { type: String, trim: true, default: '' },
    level: { type: String, enum: ['OFFICER', 'DEPARTMENT_OFFICER', 'HEAD'], required: true },
    targetRole: { type: String, trim: true, default: '' },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, required: true, trim: true, maxlength: 600 },
    previousStatus: { type: String, enum: WORKFLOW_STATUSES, required: true },
    status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN', index: true },
    resolution: { type: String, trim: true, maxlength: 600, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    /** Status the incident resumed at once the escalation was handled. */
    resumedAt: { type: String, enum: [...WORKFLOW_STATUSES, ''], default: '' }
  },
  { timestamps: true }
);

escalationSchema.index({ emergency: 1, status: 1, createdAt: -1 });
escalationSchema.index({ targetRole: 1, status: 1, createdAt: -1 });

export default mongoose.model('EmergencyEscalation', escalationSchema);
