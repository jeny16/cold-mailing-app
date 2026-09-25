import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
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
    firstContactedAt: {
      type: Date,
      default: null,
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
    totalEmailsSent: {
      type: Number,
      default: 0,
    },
    totalWhatsAppSent: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DO_NOT_CONTACT', 'BOUNCED'],
      default: 'ACTIVE',
    },
    jobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
      },
    ],
  },
  {
    timestamps: true,
  }
);

ContactSchema.index({ phone: 1 });
ContactSchema.index({ company: 1 });

export const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
export default Contact;
