import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    targetType: { type: String, enum: ['user', 'department', 'complaint', 'emergency', 'report', 'system'], required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    targetName: { type: String, trim: true, maxlength: 200, default: '' },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Snapshot of the actor's role at write time so audit filters stay accurate
    // even if the account role changes later. Legacy rows have '' and the UI
    // reports them as "Not recorded" instead of guessing.
    actorRole: { type: String, trim: true, maxlength: 40, default: '' },
    result: { type: String, enum: ['success', 'failure', 'info'], default: 'info', index: true }
  },
  { timestamps: true }
);

activityLogSchema.index({ admin: 1, createdAt: -1 });
activityLogSchema.index({ targetType: 1, targetId: 1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });


export default mongoose.model('ActivityLog', activityLogSchema);
