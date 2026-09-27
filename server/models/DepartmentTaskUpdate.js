import mongoose from 'mongoose';

const taskUpdateSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'DepartmentTask', required: true, index: true },
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', index: true },
    departmentName: { type: String, required: true, trim: true, index: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    kind: {
      type: String,
      trim: true,
      default: 'progress',
      index: true
    },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    progressPercent: { type: Number, min: 0, max: 100 },
    /** Material, plant or crew the worker needs to continue. */
    blocker: {
      reason: { type: String, trim: true, maxlength: 200, default: '' },
      detail: { type: String, trim: true, maxlength: 1000, default: '' },
      resourceNeeded: { type: String, trim: true, maxlength: 300, default: '' }
    },
    evidence: [{
      url: { type: String, required: true },
      filename: { type: String, default: '' },
      mediaType: { type: String, enum: ['image', 'video'], default: 'image' }
    }],
    location: {
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null }
    }
  },
  { timestamps: true }
);

taskUpdateSchema.index({ task: 1, createdAt: -1 });
taskUpdateSchema.index({ departmentName: 1, createdAt: -1 });
taskUpdateSchema.index({ worker: 1, createdAt: -1 });

export default mongoose.model('DepartmentTaskUpdate', taskUpdateSchema);