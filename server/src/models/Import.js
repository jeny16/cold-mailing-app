import mongoose from 'mongoose';

const ImportSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: 'Manual Import',
    },
    totalRecords: {
      type: Number,
      default: 0,
    },
    validRecords: {
      type: Number,
      default: 0,
    },
    invalidRecords: {
      type: Number,
      default: 0,
    },
    duplicateRecords: {
      type: Number,
      default: 0,
    },
    newRecords: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL', 'FAILED'],
      default: 'SUCCESS',
    },
    errors: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    importedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

export const Import = mongoose.models.Import || mongoose.model('Import', ImportSchema);
export default Import;
