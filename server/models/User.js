import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 30, default: '', index: true },
    photoURL: { type: String, default: '' },
    role: { type: String, enum: ['citizen', 'admin', 'department_head', 'department_officer', 'officer', 'field_worker', 'emergency_department_head', 'emergency_department_officer', 'emergency_officer', 'emergency_field_worker'], default: 'citizen', index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    departmentName: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    emailVerified: { type: Boolean, default: false },
    preferences: { emailNotifications: { type: Boolean, default: true } }
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return { id: this._id, firebaseUid: this.firebaseUid, name: this.name, email: this.email, phone: this.phone, photoURL: this.photoURL, role: this.role, department: this.department, departmentName: this.departmentName, status: this.status, emailVerified: this.emailVerified, createdAt: this.createdAt };
};

export default mongoose.model('User', userSchema);
