import mongoose from 'mongoose';

const emergencySchema = new mongoose.Schema(
  {
    citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    citizenName: { type: String, required: true, trim: true, maxlength: 120 },
    citizenPhone: { type: String, trim: true, maxlength: 30, default: '' },
    citizenEmail: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
    emergencyId: { type: String, unique: true, sparse: true, index: true },
    // type remains for compatibility with any older records; category is the flexible public API field.
    type: { type: String, trim: true, default: 'other', index: true },
    category: { type: String, trim: true, default: 'not_sure', index: true },
    subcategory: { type: String, trim: true, default: 'other' },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    location: {
      address: { type: String, trim: true, maxlength: 300, default: '' },
      landmark: { type: String, trim: true, maxlength: 150, default: '' },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 }
    },
    status: { type: String, trim: true, default: 'reported', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high', index: true },
    // How the emergency entered the system: detailed report, quick SOS, discreet "I'm Not Safe", or staff entry.
    source: { type: String, enum: ['report', 'sos', 'not_safe', 'staff'], default: 'report', index: true },
    discreet: { type: Boolean, default: false },
    // restricted = sensitive incident (women/child safety, missing person, crime): excluded from public aggregates and community verification.
    visibility: { type: String, enum: ['standard', 'restricted'], default: 'standard', index: true },
    // Missing person / child safety subject details. Visible only to command and assigned participants.
    personDetails: {
      name: { type: String, trim: true, maxlength: 120, default: '' },
      age: { type: String, trim: true, maxlength: 10, default: '' },
      photoUrl: { type: String, trim: true, maxlength: 500, default: '' },
      description: { type: String, trim: true, maxlength: 1000, default: '' },
      clothing: { type: String, trim: true, maxlength: 300, default: '' },
      additionalInfo: { type: String, trim: true, maxlength: 1000, default: '' },
      lastSeenAt: { type: Date, default: null },
      lastKnownLocation: { address: { type: String, trim: true, maxlength: 300, default: '' }, latitude: { type: Number, min: -90, max: 90, default: null }, longitude: { type: Number, min: -180, max: 180, default: null } }
    },
    // Advisory rule-engine suggestion. Emergency Head may apply or override it at any time.
    aiSuggestion: {
      category: { type: String, default: '' },
      subcategory: { type: String, default: '' },
      severity: { type: String, default: '' },
      responseTypes: [{ type: String }],
      summary: { type: String, maxlength: 300, default: '' },
      confidence: { type: String, enum: ['high', 'medium', 'low', ''], default: '' },
      source: { type: String, default: 'rule_engine' },
      suggestedAt: { type: Date, default: null },
      appliedAt: { type: Date, default: null },
      overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },
    // Response timer milestones. Never fabricated — remain null until the real event happens.
    dispatchedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    enRouteAt: { type: Date, default: null },
    // Snapshot of the citizen's enabled SOS contacts (delivery channel, if any, is reported honestly).
    sosContacts: [{ name: { type: String, maxlength: 100 }, phone: { type: String, maxlength: 30 }, relationship: { type: String, maxlength: 60 } }],
    // Limited community verification for standard-visibility incidents only.
    communityVerification: {
      stillHappening: { type: Number, default: 0 },
      resolvedVotes: { type: Number, default: 0 },
      votes: [{ citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, vote: { type: String, enum: ['still_happening', 'resolved'] }, at: { type: Date, default: Date.now } }],
      notes: [{ citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: { type: String, maxlength: 400, default: '' }, at: { type: Date, default: Date.now } }]
    },
    assignedDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedFieldWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    emergencyHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    responseAssignments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyResponseAssignment' }],
    masterEmergency: { type: mongoose.Schema.Types.ObjectId, ref: 'Emergency', default: null, index: true },
    relatedEmergencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Emergency' }],
    evidence: [{ filename: String, originalName: String, mediaType: String, url: String }],
    escalation: { escalatedAt: Date, escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, default: '' } },
    responseTimeMinutes: { type: Number, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    arrivalAt: { type: Date, default: null },
    resolutionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    citizenFeedback: { rating: { type: Number, min: 1, max: 5 }, comment: { type: String, maxlength: 1000, default: '' } },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    activity: [{
      action: { type: String, required: true },
      actorRole: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      note: { type: String, maxlength: 500, default: '' }
    }]
  },
  { timestamps: true }
);

emergencySchema.index({ citizen: 1, createdAt: -1 });
emergencySchema.index({ status: 1, createdAt: -1 });
emergencySchema.index({ category: 1, createdAt: -1 });
emergencySchema.index({ severity: 1, status: 1, createdAt: -1 });
emergencySchema.index({ visibility: 1, createdAt: -1 });
emergencySchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
emergencySchema.index({ responseAssignments: 1, status: 1 });
emergencySchema.index({ type: 1, status: 1 });
emergencySchema.index({ assignedOfficer: 1, status: 1 });
emergencySchema.index({ assignedFieldWorker: 1, status: 1 });
emergencySchema.index({ masterEmergency: 1, createdAt: -1 });

export default mongoose.model('Emergency', emergencySchema);
