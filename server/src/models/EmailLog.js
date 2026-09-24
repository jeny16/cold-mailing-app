import mongoose from 'mongoose';

const EmailLogSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      default: null,
      index: true,
    },
    messageId: {
      type: String,
      default: '',
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'],
      default: 'QUEUED',
      index: true,
    },
    error: {
      type: String,
      default: '',
    },
    queuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    isDryRun: {
      type: Boolean,
      default: false,
    },
    hasAttachment: {
      type: Boolean,
      default: true,
    },
    attachmentName: {
      type: String,
      default: 'resume.pdf',
    },
  },
  {
    timestamps: true,
  }
);

EmailLogSchema.index({ sentAt: -1, status: 1 });

export const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', EmailLogSchema);
export default EmailLog;
