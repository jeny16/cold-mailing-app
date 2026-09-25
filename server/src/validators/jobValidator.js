import { z } from 'zod';

/**
 * Preprocessor that normalizes flat format and rich CRM nested format
 */
function normalizeJobInput(val) {
  if (!val || typeof val !== 'object') return val;
  const clone = { ...val };

  const contact = clone.contact || {};
  const jobDetails = clone.job || {};

  // Extract email
  if (!clone.hrEmail && contact.email) {
    clone.hrEmail = contact.email;
  }
  // Extract HR Name
  if (!clone.hrName && contact.hrName) {
    clone.hrName = contact.hrName;
  }
  // Extract Job URL
  if (!clone.jobUrl && jobDetails.jobUrl) {
    clone.jobUrl = jobDetails.jobUrl;
  }
  // Extract location
  if (!clone.location && jobDetails.location) {
    clone.location = jobDetails.location;
  }
  // Extract requirements
  if ((!clone.requirements || !clone.requirements.length) && jobDetails.requirements) {
    clone.requirements = jobDetails.requirements;
  }
  // Extract source
  if (!clone.source && jobDetails.source) {
    clone.source = jobDetails.source;
  }
  // Extract remote / workMode
  if (clone.remote === undefined && jobDetails.workMode) {
    clone.remote = jobDetails.workMode.toLowerCase().includes('remote');
  }

  return clone;
}

export const SingleJobSchema = z.preprocess(
  normalizeJobInput,
  z.object({
    id: z.string().optional(),
    company: z.string({ required_error: 'Company is required' }).trim().min(1, 'Company cannot be empty'),
    role: z.string({ required_error: 'Role is required' }).trim().min(1, 'Role cannot be empty'),
    jobType: z.string().optional().default('specific_opening'),
    hrEmail: z
      .string({ required_error: 'HR Email is required' })
      .trim()
      .email('Invalid email address format'),
    hrName: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
    jobUrl: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
    source: z.string().optional().nullable().transform((v) => (v ? v.trim() : 'AI Agent')),
    location: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
    remote: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') return v.toLowerCase() === 'true';
        return false;
      }),
    description: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
    requirements: z
      .union([z.array(z.string()), z.string()])
      .optional()
      .transform((v) => {
        if (Array.isArray(v)) return v.map((item) => String(item).trim()).filter(Boolean);
        if (typeof v === 'string' && v.trim().length > 0) return [v.trim()];
        return [];
      }),
    notes: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),

    // CRM Contact structure
    contact: z
      .object({
        hrName: z.string().optional().default(''),
        hrJobTitle: z.string().optional().default('HR / Recruitment Team'),
        email: z.string().optional().default(''),
        phone: z.string().optional().default(''),
        whatsapp: z.string().optional().default(''),
        linkedin: z.string().optional().default(''),
      })
      .optional()
      .default({}),

    // CRM Job structure
    job: z
      .object({
        jobUrl: z.string().optional().default(''),
        source: z.string().optional().default('Company Career Page'),
        location: z.string().optional().default(''),
        workMode: z.string().optional().default('Work From Office'),
        employmentType: z.string().optional().default('Full-Time'),
        experienceRequired: z.string().optional().default(''),
        requirements: z.array(z.string()).optional().default([]),
      })
      .optional()
      .default({}),

    // Email
    email: z
      .object({
        to: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
        subject: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
        body: z.string().optional().nullable().transform((v) => (v ? v : '')),
        status: z.string().optional().default('not_sent'),
        sentAt: z.any().optional().nullable(),
      })
      .optional()
      .default({}),

    // WhatsApp
    whatsapp: z
      .object({
        phone: z.string().optional().default(''),
        message: z.string().optional().default(''),
        status: z.string().optional().default('not_sent'),
        copiedAt: z.any().optional().nullable(),
        sentAt: z.any().optional().nullable(),
      })
      .optional()
      .default({}),

    // LinkedIn
    linkedin: z
      .object({
        profileUrl: z.string().optional().default(''),
        message: z.string().optional().default(''),
        status: z.string().optional().default('not_contacted'),
        contactedAt: z.any().optional().nullable(),
      })
      .optional()
      .default({}),

    // Tracking
    tracking: z
      .object({
        status: z.string().optional().default('NEW'),
        createdAt: z.any().optional(),
        lastContactedAt: z.any().optional().nullable(),
        nextFollowUpAt: z.any().optional().nullable(),
        followUpCount: z.number().optional().default(0),
        notes: z.string().optional().default(''),
      })
      .optional()
      .default({}),

    contactVerification: z
      .object({
        status: z.string().optional().nullable(),
        reason: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
);

export const JobsFileSchema = z.object({
  batchId: z.string().optional(),
  generatedAt: z.string().optional(),
  sender: z.record(z.any()).optional(),
  deduplication: z.record(z.any()).optional(),
  sendingPolicy: z.record(z.any()).optional(),
  jobs: z.array(SingleJobSchema).min(1, 'The JSON file must contain at least 1 job in the "jobs" array'),
});

/**
 * Validate a whole parsed JSON file object
 */
export function validateJobsPayload(payload) {
  const result = JobsFileSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data.jobs };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  };
}

/**
 * Validate a single job item
 */
export function validateSingleJob(rawJob) {
  const result = SingleJobSchema.safeParse(rawJob);
  if (result.success) {
    const data = result.data;
    // Harmonize nested fields
    if (!data.contact.email) data.contact.email = data.hrEmail;
    if (!data.contact.hrName) data.contact.hrName = data.hrName;
    if (!data.contact.whatsapp && data.contact.phone) data.contact.whatsapp = data.contact.phone;
    if (!data.whatsapp.phone && data.contact.phone) data.whatsapp.phone = data.contact.phone;
    if (!data.job.jobUrl && data.jobUrl) data.job.jobUrl = data.jobUrl;
    if (!data.job.location && data.location) data.job.location = data.location;
    if (!data.job.requirements.length && data.requirements.length) data.job.requirements = data.requirements;

    return { success: true, data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

export default {
  SingleJobSchema,
  JobsFileSchema,
  validateJobsPayload,
  validateSingleJob,
};
