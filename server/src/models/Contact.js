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
    status: {
      type: String,
      enum: ['ACTIVE', 'DO_NOT_CONTACT', 'BOUNCED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

export const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
export default Contact;
