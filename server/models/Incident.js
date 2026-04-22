import mongoose from 'mongoose';

const timelineEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, required: true },
    type: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
  },
  { _id: true }
);

const customerUpdateSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, required: true },
    channel: { type: String, enum: ['email', 'slack', 'status_page', 'phone', 'ticket'], default: 'status_page' },
    message: { type: String, required: true, trim: true },
    author: { type: String, trim: true },
  },
  { _id: true }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    severity: {
      type: String,
      required: true,
      enum: ['sev0', 'sev1', 'sev2', 'sev3', 'sev4'],
    },
    status: {
      type: String,
      required: true,
      enum: ['open', 'acknowledged', 'mitigating', 'resolved', 'closed'],
    },
    /** Ref: Customer document — normalized customer master data */
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    /** Ref: Service catalog — one incident can hit multiple services */
    serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    tags: [{ type: String, trim: true }],
    impactedRegions: [{ type: String, trim: true }],
    openedAt: { type: Date, required: true, default: Date.now, index: true },
    resolvedAt: { type: Date, default: null },
    owner: { type: String, trim: true },
    rootCause: { type: String, trim: true },
    remediation: { type: String, trim: true },
    /** Embedded: append-only event stream for the incident (good for $push + display order) */
    timelineEvents: [timelineEventSchema],
    /** Embedded: customer-facing comms log */
    customerUpdates: [customerUpdateSchema],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/**
 * Index strategy (operational + dashboard):
 * - status + severity + openedAt: default incident queue / triage list (filter + sort)
 * - customerId + status: per-customer open incidents and SLA views
 * - tags: ad-hoc filtering (e.g. "api", "auth")
 * - text: full-text on title + description (Atlas or self-hosted text index)
 * TODO: if query patterns grow, add partial indexes, e.g. { status: 1, openedAt: -1 } where status != "closed"
 */
incidentSchema.index({ status: 1, severity: 1, openedAt: -1 });
incidentSchema.index({ customerId: 1, status: 1 });
incidentSchema.index({ tags: 1 });
incidentSchema.index({ title: 'text', description: 'text' });

export const Incident = mongoose.model('Incident', incidentSchema);
