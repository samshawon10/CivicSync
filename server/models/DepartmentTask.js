import mongoose from 'mongoose';
import { TASK_STATES } from '../services/taskWorkflow.js';

const departmentTaskSchema = new mongoose.Schema(
  {
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true, index: true },
    taskNumber: { type: String, trim: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    departmentName: { type: String, required: true, trim: true, index: true },

    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'DepartmentTeam', default: null, index: true },
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    workerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: TASK_STATES, default: 'pending', index: true },
    /** Denormalised from the linked case so lists can filter without a join. */
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    instructions: { type: String, trim: true, maxlength: 2000, default: '' },
    targetDueAt: { type: Date, default: null },
    timeline: [
      {
        status: { type: String, required: true },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorRole: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: '' },
        location: {
          latitude: { type: Number, default: null },
          longitude: { type: Number, default: null }
        }
      }
    ],
    rejection: {
      reason: { type: String, default: '' },
      rejectedAt: { type: Date, default: null },
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },
    blockedInfo: {
      reason: { type: String, default: '' },
      description: { type: String, default: '' },
      resourceNeeded: { type: String, default: '' },
      reportedAt: { type: Date, default: null },
      resolvedAt: { type: Date, default: null }
    },
    completion: {
      summary: { type: String, default: '' },
      result: { type: String, default: '' },
      materialsUsed: { type: String, default: '' },
      remainingIssues: { type: String, default: '' },
      completedAt: { type: Date, default: null },
      evidenceUrls: [{ type: String }]
    },
    location: {
      address: { type: String, default: '' },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null }
    }
  },
  { timestamps: true }
);

departmentTaskSchema.index({ assignedWorker: 1, status: 1 });
departmentTaskSchema.index({ workerIds: 1, status: 1 });
departmentTaskSchema.index({ departmentName: 1, status: 1 });
departmentTaskSchema.index({ team: 1, status: 1 });
departmentTaskSchema.index({ assignedOfficer: 1, status: 1 });

export default mongoose.model('DepartmentTask', departmentTaskSchema);
