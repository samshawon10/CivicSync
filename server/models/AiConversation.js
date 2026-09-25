import mongoose from 'mongoose';

/**
 * Persisted AI Copilot conversation threads.
 *
 * Stores role-scoped conversations with safety redaction, tool traces,
 * token accounting, and citations for auditing and context resumption.
 */
const aiMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    citations: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => []
    },
    suggestedActions: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => []
    },
    actionConfirmation: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    toolCalls: {
      type: [mongoose.Schema.Types.Mixed],
      default: () => []
    },
    provider: {
      type: String,
      default: null
    },
    model: {
      type: String,
      default: null
    },
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 }
    },
    degraded: {
      type: Boolean,
      default: false
    },
    feedback: {
      rating: { type: String, enum: ['helpful', 'unhelpful', null], default: null },
      comment: { type: String, default: null },
      updatedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

const aiConversationSchema = new mongoose.Schema(
  {
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
    title: {
      type: String,
      trim: true,
      maxlength: 140,
      default: 'New CivicSync Conversation'
    },
    pageContext: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    messages: [aiMessageSchema],
    pinned: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

aiConversationSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('AiConversation', aiConversationSchema);
