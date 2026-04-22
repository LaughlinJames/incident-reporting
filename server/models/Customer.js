import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    accountTier: {
      type: String,
      enum: ['free', 'standard', 'enterprise'],
      default: 'standard',
    },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    industry: { type: String, trim: true },
    region: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

/**
 * TODO: add compound indexes for multi-tenant / region reporting if you partition by org.
 */
customerSchema.index({ name: 1 });

export const Customer = mongoose.model('Customer', customerSchema);
