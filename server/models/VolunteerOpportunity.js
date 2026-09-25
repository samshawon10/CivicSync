import mongoose from 'mongoose';

const volunteerOpportunitySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  type: {
    type: String,
    enum: ['cleanup', 'community_event', 'awareness', 'emergency_assist', 'donation', 'local_improvement'],
    default: 'cleanup',
    index: true
  },
  location: {
    address: { type: String, trim: true, maxlength: 300, default: '' },
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null }
  },
  date: { type: Date, default: null },
  maxParticipants: { type: Number, default: 20 },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['open', 'completed', 'cancelled'], default: 'open', index: true }
}, { timestamps: true });

volunteerOpportunitySchema.index({ type: 1, status: 1 });
volunteerOpportunitySchema.index({ 'participants.user': 1 });

export default mongoose.model('VolunteerOpportunity', volunteerOpportunitySchema);
