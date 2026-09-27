import mongoose from 'mongoose';
import { RESPONSE_TYPES, TEAM_KINDS, TEAM_MEMBER_STATUS } from '../config/emergencyOps.js';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, trim: true, maxlength: 120, default: '' },
    role: { type: String, trim: true, default: 'emergency_field_worker' },
    status: { type: String, enum: TEAM_MEMBER_STATUS, default: 'ACTIVE' },
    joinedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    fieldWorkStartedAt: { type: Date, default: null },
    fieldWorkCompletedAt: { type: Date, default: null },
    completionNotes: { type: String, trim: true, maxlength: 500, default: '' },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, trim: true, maxlength: 300, default: '' }
  },
  { _id: true }
);

const responseTeamSchema = new mongoose.Schema(
  {
    teamCode: { type: String, unique: true, index: true },
    kind: { type: String, enum: TEAM_KINDS, default: 'TASK', index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    emergency: { type: mongoose.Schema.Types.ObjectId, ref: 'Emergency', default: null, index: true },
    responseType: { type: String, enum: [...RESPONSE_TYPES, null], default: null },
    /** The Emergency Officer accountable for this team. */
    officer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    members: { type: [memberSchema], default: [] },
    status: { type: String, enum: ['FORMED', 'DISBANDED'], default: 'FORMED', index: true },
    disbandedAt: { type: Date, default: null },
    disbandReason: { type: String, trim: true, maxlength: 300, default: '' }
  },
  { timestamps: true }
);

responseTeamSchema.index({ emergency: 1, status: 1 });
responseTeamSchema.index({ officer: 1, kind: 1, status: 1 });
responseTeamSchema.index({ 'members.user': 1, status: 1 });
responseTeamSchema.index({ kind: 1, createdAt: -1 });

/** Deterministic, human-readable code derived from the document id. */
responseTeamSchema.pre('validate', function assignCode(next) {
  if (!this.teamCode) {
    const prefix = this.kind === 'ROSTER' ? 'ROSTER' : 'TEAM';
    this.teamCode = `${prefix}-${String(this._id || new mongoose.Types.ObjectId()).slice(-6).toUpperCase()}`;
  }
  next();
});

/** Members who still hold the booking (i.e. have not been released). */
responseTeamSchema.methods.holdingMembers = function holdingMembers() {
  return this.members.filter((member) => member.status !== 'RELEASED');
};

export default mongoose.model('EmergencyResponseTeam', responseTeamSchema);
