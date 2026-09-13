import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    photoURL: { type: String, default: '' },
    role: { type: String, enum: ['citizen', 'department_head', 'department_officer', 'field_worker', 'admin'], default: 'citizen' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    emailVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return { id: this._id, firebaseUid: this.firebaseUid, name: this.name, email: this.email, photoURL: this.photoURL, role: this.role, department: this.department, status: this.status, emailVerified: this.emailVerified, createdAt: this.createdAt };
};

export default mongoose.model('User', userSchema);
