import mongoose from 'mongoose';

export const reportCategories = [
  'road',
  'traffic_management',
  'street_lighting',
  'waste_management',
  'water_supply',
  'drainage',
  'public_infrastructure',
  'parks_environment',
  'public_health',
  'electricity',
  'public_safety',
  'noise_pollution',
  'illegal_dumping',
  'other'
];

export const reportDepartments = [
  'Roads and Transportation',
  'Traffic Management',
  'Street Lighting',
  'Waste Management',
  'Water Supply',
  'Drainage and Sewerage',
  'Public Infrastructure',
  'Parks and Environment',
  'Public Health',
  'Electricity Services',
  'Public Safety',
  'General Services'
];

const reportSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  category: { type: String, required: true, enum: reportCategories },
  departmentName: { type: String, required: true, trim: true, enum: reportDepartments },
  status: { type: String, enum: ['pending', 'verified', 'assigned', 'in_progress', 'completed', 'closed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
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

export default mongoose.model('Report', reportSchema);
