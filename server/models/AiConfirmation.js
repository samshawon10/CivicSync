import mongoose from 'mongoose';

const aiConfirmationSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      required: true
    },
    actionName: {
      type: String,
      required: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    explanation: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'expired'],
      default: 'pending',
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index automatically cleans up expired documents
    }
  },
  { timestamps: true }
);

aiConfirmationSchema.index({ user: 1, status: 1, createdAt: -1 });

export default mongoose.model('AiConfirmation', aiConfirmationSchema);
