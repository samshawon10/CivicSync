import mongoose from 'mongoose';

/** A citizen's saved services. Unique index prevents duplicate saves. */
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'CivicService', required: true }
}, { timestamps: true });

schema.index({ user: 1, service: 1 }, { unique: true });
schema.index({ user: 1, createdAt: -1 });

export default mongoose.model('CivicServiceSave', schema);
