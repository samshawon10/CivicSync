import mongoose from 'mongoose';

export const DEPARTMENT_ASSIGNABLE_ROLES = [
  'department_head',
  'department_officer',
  'officer',
  'field_worker',
  'emergency_department_head',
  'emergency_department_officer',
  'emergency_officer',
  'emergency_field_worker'
];

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true
    },
    code: {
      type: String,
      trim: true,
      maxlength: 40,
      uppercase: true,
      sparse: true,
      unique: true,
      default: null
    },
    type: { type: String, trim: true, maxlength: 80, default: '' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    icon: { type: String, trim: true, maxlength: 80, default: 'building2' },
    color: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '#2563eb',
      validate: {
        validator: (value) => !value || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
        message: 'Color must be a valid hex color (e.g. #2563eb).'
      }
    },
    contactNumber: { type: String, trim: true, maxlength: 30, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    scope: {
      type: String,
      enum: ['civic', 'emergency', 'hybrid'],
      default: 'civic',
      index: true
    },
    emergencyTypes: [
      {
        type: String,
        enum: ['police', 'fire', 'medical', 'accident', 'disaster', 'other']
      }
    ],

    assignedRoles: {
      type: [String],
      default: [],
      validate: {
        validator: (value) =>
          value.every((role) => DEPARTMENT_ASSIGNABLE_ROLES.includes(role)),
        message: 'One or more roles are not valid department-level roles.'
      }
    },
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    emergencyHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

departmentSchema.index({ head: 1 }, { unique: true, sparse: true });
departmentSchema.index({ emergencyHead: 1 }, { unique: true, sparse: true });
departmentSchema.index({ emergencyTypes: 1, status: 1 });
// Note: code index is declared inline on the field (unique: true, sparse: true) — no need to repeat here.

departmentSchema.pre('save', function preSave(next) {
  if (!this.code) {
    this.code = this.name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || null;
  }
  next();
});

export default mongoose.model('Department', departmentSchema);
