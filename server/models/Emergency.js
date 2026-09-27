import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: undefined }
}, { _id: false });

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
      longitude: { type: Number, min: -180, max: 180 },
      accuracy: { type: Number, min: 0, default: null },
      capturedAt: { type: Date, default: null },
      // GeoJSON duplicates validated coordinates for indexed geospatial queries.
      // The legacy latitude/longitude fields above remain for compatibility.
      point: { type: pointSchema, default: undefined }
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

    ops: {
      workflowStatus: { type: String, default: 'SUBMITTED', index: true },
      emergencyType: { type: String, default: 'OTHER' },
      responseTypes: { type: [String], default: [] },
      priority: { type: String, default: 'MEDIUM' },
      priorityHistory: [{
        priority: { type: String, default: '' },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        changedByRole: { type: String, default: '' },
        reason: { type: String, trim: true, maxlength: 400, default: '' },
        at: { type: Date, default: Date.now }
      }],
      reviewed: { type: Boolean, default: false },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      reviewNotes: { type: String, trim: true, maxlength: 1000, default: '' },
      // Emergency Department Officer holding the incident.
      departmentOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      departmentOfficerAssignedAt: { type: Date, default: null },
      departmentOfficerAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      // Emergency Officer leading the field response.
      emergencyOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      emergencyOfficerAssignedAt: { type: Date, default: null },
      emergencyOfficerAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      acceptedAt: { type: Date, default: null },
      teamFormedAt: { type: Date, default: null },
      enRouteAt: { type: Date, default: null },
      onSceneAt: { type: Date, default: null },
      responseStartedAt: { type: Date, default: null },
      completionPercent: { type: Number, min: 0, max: 100, default: 0 },
      workCompletedAt: { type: Date, default: null },
      workCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      resolutionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
      closedAt: { type: Date, default: null },
      closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      closingNotes: { type: String, trim: true, maxlength: 2000, default: '' },
      cancelledAt: { type: Date, default: null },
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      cancellationReason: { type: String, trim: true, maxlength: 600, default: '' },
      falseReportAt: { type: Date, default: null },
      falseReportBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      falseReportReason: { type: String, trim: true, maxlength: 600, default: '' },
      // Live escalation for the incident (history lives in EmergencyEscalation).
      activeEscalation: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyEscalation', default: null },
        level: { type: String, default: '' },
        previousStatus: { type: String, default: '' },
        raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        raisedAt: { type: Date, default: null },
        reason: { type: String, trim: true, maxlength: 600, default: '' }
      },
      progress: [{
        text: { type: String, trim: true, maxlength: 600, default: '' },
        percent: { type: Number, min: 0, max: 100, default: null },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        byRole: { type: String, default: '' },
        team: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyResponseTeam', default: null },
        at: { type: Date, default: Date.now }
      }],
      blockers: [{
        text: { type: String, trim: true, maxlength: 600, default: '' },
        kind: { type: String, trim: true, maxlength: 40, default: 'OTHER' },
        severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
        requiredResource: { type: String, trim: true, maxlength: 200, default: '' },
        raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        raisedByRole: { type: String, default: '' },
        raisedAt: { type: Date, default: Date.now },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        resolvedAt: { type: Date, default: null },
        resolution: { type: String, trim: true, maxlength: 600, default: '' }
      }],
      instructions: [{
        text: { type: String, trim: true, maxlength: 600, default: '' },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        byRole: { type: String, default: '' },
        at: { type: Date, default: Date.now }
      }]
    },
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
emergencySchema.index({ 'location.point': '2dsphere' }, { sparse: true });
emergencySchema.index({ responseAssignments: 1, status: 1 });
emergencySchema.index({ type: 1, status: 1 });
emergencySchema.index({ assignedOfficer: 1, status: 1 });
emergencySchema.index({ assignedFieldWorker: 1, status: 1 });
emergencySchema.index({ masterEmergency: 1, createdAt: -1 });
// Emergency operations queue: command reads by status + priority, each level
// reads the incidents it personally holds.
emergencySchema.index({ 'ops.workflowStatus': 1, 'ops.priority': 1, createdAt: -1 });
emergencySchema.index({ 'ops.departmentOfficer': 1, 'ops.workflowStatus': 1 });
emergencySchema.index({ 'ops.emergencyOfficer': 1, 'ops.workflowStatus': 1 });

export default mongoose.model('Emergency', emergencySchema);
