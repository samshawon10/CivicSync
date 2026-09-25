import mongoose from 'mongoose';

/**
 * Ephemeral human-in-the-loop action confirmation records (task §10).
 *
 * When an AI reasoning step proposes an action (such as drafting/submitting a report),
 * an AiConfirmation token is minted with an expiration TTL.
 * The user can inspect the exact payload in the UI and confirm or reject it.
 * Only upon valid user confirmation with role enforcement does the ActionExecutor run.
 */
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
