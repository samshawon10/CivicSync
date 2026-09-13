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

export default mongoose.model('Report', reportSchema);
