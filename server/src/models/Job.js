import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema(
  {
    // Basic identifiers
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      index: true,
    },
    role: {
      type: String,
      required: [true, 'Role title is required'],
      trim: true,
      index: true,
    },
    jobType: {
      type: String,
      default: 'specific_opening',
      trim: true,
    },

    // Legacy fields maintained for 100% backward compatibility
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

    // CRM Contact Details
    contact: {
      hrName: {
        type: String,
        trim: true,
        default: '',
      },
      hrJobTitle: {
        type: String,
        trim: true,
        default: 'HR / Recruitment Team',
      },
      email: {
        type: String,
        trim: true,
        default: '',
      },
      phone: {
        type: String,
        trim: true,
        default: '',
      },
      whatsapp: {
        type: String,
        trim: true,
        default: '',
      },
      linkedin: {
        type: String,
        trim: true,
        default: '',
      },
    },

    // CRM Job Specs
    job: {
      jobUrl: {
        type: String,
        trim: true,
        default: '',
      },
      source: {
        type: String,
        trim: true,
        default: 'Company Career Page',
      },
      location: {
        type: String,
        trim: true,
        default: '',
      },
      workMode: {
        type: String,
        trim: true,
        default: 'Work From Office',
      },
      employmentType: {
        type: String,
        trim: true,
        default: 'Full-Time',
      },
      experienceRequired: {
        type: String,
        trim: true,
        default: '',
      },
      requirements: {
        type: [String],
        default: [],
      },
    },

    // Email outreach tracking
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
      status: {
        type: String,
        enum: ['not_sent', 'queued', 'sending', 'sent', 'failed'],
        default: 'not_sent',
        index: true,
      },
      sentAt: {
        type: Date,
        default: null,
      },
      messageId: {
        type: String,
        default: '',
      },
    },

    // WhatsApp outreach tracking
    whatsapp: {
      phone: {
        type: String,
        trim: true,
        default: '',
      },
      message: {
        type: String,
        default: '',
      },
      status: {
        type: String,
        enum: ['not_sent', 'copied', 'sent'],
        default: 'not_sent',
        index: true,
      },
      copiedAt: {
        type: Date,
        default: null,
      },
      sentAt: {
        type: Date,
        default: null,
      },
    },

    // LinkedIn outreach tracking
    linkedin: {
      profileUrl: {
        type: String,
        trim: true,
        default: '',
      },
      message: {
        type: String,
        default: '',
      },
      status: {
        type: String,
        enum: ['not_contacted', 'connected', 'contacted'],
        default: 'not_contacted',
      },
      contactedAt: {
        type: Date,
        default: null,
      },
    },

    // CRM Tracking State
    tracking: {
      status: {
        type: String,
        default: 'NEW',
        index: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      lastContactedAt: {
        type: Date,
        default: null,
      },
      nextFollowUpAt: {
        type: Date,
        default: null,
        index: true,
      },
      followUpCount: {
        type: Number,
        default: 0,
      },
      notes: {
        type: String,
        default: '',
      },
    },

    // Contact History / Activity Timeline
    timeline: [
      {
        action: {
          type: String,
          required: true,
        },
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          default: '',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        meta: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],

    // Global / Queue Status
    status: {
      type: String,
      enum: [
        'NEW',
        'RESEARCHED',
        'READY_TO_CONTACT',
        'EMAIL_SENT',
        'WHATSAPP_PENDING',
        'WHATSAPP_SENT',
        'LINKEDIN_CONTACTED',
        'REPLIED',
        'INTERVIEW',
        'REJECTED',
        'NO_RESPONSE',
        'FOLLOW_UP',
        'CLOSED',
        // Legacy statuses supported for queue engine
        'REVIEW',
        'APPROVED',
        'QUEUED',
        'SENDING',
        'SENT',
        'FAILED',
        'SKIPPED',
      ],
      default: 'NEW',
      index: true,
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

// Pre-save synchronization hook: keep legacy and nested fields in sync
JobSchema.pre('save', function (next) {
  // Sync email
  if (this.contact && this.contact.email) {
    if (!this.hrEmail) this.hrEmail = this.contact.email;
  } else if (this.hrEmail) {
    if (!this.contact) this.contact = {};
    this.contact.email = this.hrEmail;
  }
  if (this.hrEmail) {
    this.normalizedHrEmail = this.hrEmail.trim().toLowerCase();
  }

  // Sync HR Name
  if (this.contact && this.contact.hrName) {
    if (!this.hrName) this.hrName = this.contact.hrName;
  } else if (this.hrName) {
    if (!this.contact) this.contact = {};
    this.contact.hrName = this.hrName;
  }

  // Sync WhatsApp Phone
  if (this.contact && this.contact.phone) {
    if (!this.whatsapp.phone) this.whatsapp.phone = this.contact.whatsapp || this.contact.phone;
    if (!this.contact.whatsapp) this.contact.whatsapp = this.contact.phone;
  }

  // Sync Job Details
  if (this.job) {
    if (this.jobUrl && !this.job.jobUrl) this.job.jobUrl = this.jobUrl;
    if (this.location && !this.job.location) this.job.location = this.location;
    if (this.requirements && this.requirements.length && (!this.job.requirements || !this.job.requirements.length)) {
      this.job.requirements = this.requirements;
    }
  }

  // Sync Tracking Status with Main Status
  if (this.status && (!this.tracking || !this.tracking.status)) {
    if (!this.tracking) this.tracking = {};
    this.tracking.status = this.status;
  } else if (this.tracking && this.tracking.status && !this.status) {
    this.status = this.tracking.status;
  }

  next();
});

// Indexes for fast searching and CRM filtering
JobSchema.index({ company: 1, role: 1 });
JobSchema.index({ status: 1, importedAt: -1 });

export const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);
export default Job;

