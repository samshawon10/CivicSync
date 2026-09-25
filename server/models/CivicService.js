import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: undefined }
}, { _id: false });

/**
 * Official civic service information (eligibility, documents, fees, offices).
 *
 * Admin-governed by design: the platform never invents government data. Fields
 * an administrator has not filled in are reported by the API as missing rather
 * than guessed, and `requestEnabled` hands a service request into the EXISTING
 * citizen case workflow instead of a second parallel workflow.
 */
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  category: { type: String, required: true, trim: true, index: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  departmentName: { type: String, trim: true, default: '', index: true },
  summary: { type: String, trim: true, maxlength: 300, default: '' },
  description: { type: String, trim: true, maxlength: 3000, default: '' },
  eligibility: { type: String, trim: true, maxlength: 1500, default: '' },
  requiredDocuments: [{ type: String, trim: true, maxlength: 200 }],
  steps: [{ type: String, trim: true, maxlength: 300 }],
  processingTime: { type: String, trim: true, maxlength: 120, default: '' },
  fee: { type: String, trim: true, maxlength: 120, default: '' },
  contact: {
    office: { type: String, trim: true, maxlength: 160, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' }
  },
  location: {
    address: { type: String, trim: true, maxlength: 300, default: '' },
    area: { type: String, trim: true, maxlength: 100, default: '' },
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
    point: { type: pointSchema, default: undefined }
  },
  officeHours: { type: String, trim: true, maxlength: 200, default: '' },
  onlineAvailable: { type: Boolean, default: false },
  onlineUrl: { type: String, trim: true, maxlength: 500, default: '' },
  faqs: [{
    question: { type: String, trim: true, maxlength: 200, required: true },
    answer: { type: String, trim: true, maxlength: 1000, required: true }
  }],
  relatedServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CivicService' }],
  // Service -> Case hand-off. Off until an administrator enables it for a
  // service whose department is known.
  requestEnabled: { type: Boolean, default: false },
  requestDepartmentName: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  publishedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

schema.index({ status: 1, category: 1, name: 1 });
schema.index({ status: 1, departmentName: 1 });
schema.index({ location: '2dsphere' }, { sparse: true });
// This is a brand-new collection, so a text index is safe here (Mongo allows a
// single text index per collection) and gives the Service Hub a real index for
// search rather than a collection scan.
schema.index({ name: 'text', summary: 'text', description: 'text', 'location.area': 'text' });

export default mongoose.model('CivicService', schema);
