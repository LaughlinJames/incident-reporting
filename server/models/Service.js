import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, trim: true },
    region: { type: String, trim: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['active', 'deprecated', 'maintenance'], default: 'active' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/**
 * Service catalog for incident impact mapping (serviceIds on Incident).
 * (unique: true on `name` already creates an index)
 */
serviceSchema.index({ status: 1, region: 1 });

export const Service = mongoose.model('Service', serviceSchema);
