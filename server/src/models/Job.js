import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema(
  {
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Role title is required'],
      trim: true,
    },
    hrName: {
      type: String,
      trim: true,
      default: '',
    },
    hrEmail: {
      type: String,
      required: [true, 'HR email is required'],
      trim: true,
    },
    normalizedHrEmail: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    jobUrl: {
      type: String,
      trim: true,
      default: '',
    },
    normalizedJobKey: {
      type: String,
      index: true,
      trim: true,
      lowercase: true,
      default: '',
    },
    source: {
      type: String,
      trim: true,
      default: 'AI Agent',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    remote: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: '',
    },
    requirements: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: '',
    },
    email: {
      to: {
        type: String,
        trim: true,
        default: '',
      },
      subject: {
        type: String,
        trim: true,
        default: '',
      },
      body: {
        type: String,
        default: '',
      },
    },
    contactVerification: {
      status: {
        type: String,
        default: 'unverified',
      },
      reason: {
        type: String,
        default: '',
      },
    },
    status: {
      type: String,
      enum: ['NEW', 'REVIEW', 'APPROVED', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'],
      default: 'REVIEW',
      index: true,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
      index: true,
    },
    duplicateReason: {
      type: String,
      default: '',
    },
    importId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Import',
      default: null,
    },
    originalFilename: {
      type: String,
      default: '',
    },
    importedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for search and deduplication
JobSchema.index({ company: 1, role: 1 });
JobSchema.index({ status: 1, importedAt: -1 });

export const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);
export default Job;
