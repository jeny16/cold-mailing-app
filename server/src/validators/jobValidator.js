import { z } from 'zod';

/**
 * Helper to strip mailto: and angle brackets from email
 */
function cleanEmail(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.toLowerCase().startsWith('mailto:')) {
    s = s.substring(7).trim();
  }
  const angleMatch = s.match(/<([^>]+)>/);
  if (angleMatch) {
    s = angleMatch[1].trim();
  }
  return s;
}

/**
 * Checks if a string represents an empty, missing, or AI-generated placeholder email
 */
function isMissingOrPlaceholderEmail(val) {
  if (!val) return true;
  if (typeof val !== 'string') return true;
  const s = val.trim().toLowerCase();
  return (
    !s ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'n/a' ||
    s === 'na' ||
    s === 'none' ||
    s === 'not available' ||
    s === 'not provided' ||
    s === 'not found' ||
    s === 'no email' ||
    s === 'unknown' ||
    s === '-' ||
    s === 'nil'
  );
}

/**
 * Preprocessor that normalizes flat format and rich CRM nested format
 */
function normalizeJobInput(val) {
  if (!val || typeof val !== 'object') return val;
  const clone = { ...val };

  // 1. Sanitize nested objects if they are null or not objects (AI agents often return "email": null)
  if (clone.email === null || typeof clone.email !== 'object') clone.email = {};
  if (clone.whatsapp === null || typeof clone.whatsapp !== 'object') clone.whatsapp = {};
  if (clone.linkedin === null || typeof clone.linkedin !== 'object') clone.linkedin = {};
  if (clone.contact === null || typeof clone.contact !== 'object') clone.contact = {};
  if (clone.job === null || typeof clone.job !== 'object') clone.job = {};
  if (clone.tracking === null || typeof clone.tracking !== 'object') clone.tracking = {};

  const contact = clone.contact;
  const jobDetails = clone.job;

  // 2. Extract and clean candidate email
  let candidateEmail = clone.hrEmail || contact.email || (clone.email && typeof clone.email === 'object' ? clone.email.to : null);
  if (typeof candidateEmail === 'string') {
    candidateEmail = cleanEmail(candidateEmail);
  }

  // If email is missing, null, or a placeholder (e.g. AI agent didn't find public HR email)
  if (isMissingOrPlaceholderEmail(candidateEmail)) {
    const companySlug = (clone.company || 'prospect')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const fallbackEmail = `careers@${companySlug || 'prospect'}.com`;
    clone.hrEmail = fallbackEmail;
    clone.contact.email = fallbackEmail;
    if (!clone.contactVerification) {
      clone.contactVerification = {
        status: 'unverified',
        reason: 'Email not provided in lead source; placeholder generated. Use WhatsApp/LinkedIn or update email.',
      };
    }
  } else {
    clone.hrEmail = candidateEmail;
    if (!clone.contact.email) {
      clone.contact.email = candidateEmail;
    }
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

  // Cross-sync contact phone and whatsapp phone
  if (contact.phone && !contact.whatsapp) {
    contact.whatsapp = contact.phone;
  }
  if (contact.phone && !clone.whatsapp.phone) {
    clone.whatsapp.phone = contact.phone;
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
      .nullish()
      .transform((v) => v || {}),

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
      .nullish()
      .transform((v) => v || {}),

    // Email
    email: z
      .object({
        to: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
        subject: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
        body: z.string().optional().nullable().transform((v) => (v ? v : '')),
        status: z.string().optional().default('not_sent'),
        sentAt: z.any().optional().nullable(),
      })
      .nullish()
      .transform((v) => v || {}),

    // WhatsApp
    whatsapp: z
      .object({
        phone: z.string().optional().default(''),
        message: z.string().optional().default(''),
        status: z.string().optional().default('not_sent'),
        copiedAt: z.any().optional().nullable(),
        sentAt: z.any().optional().nullable(),
      })
      .nullish()
      .transform((v) => v || {}),

    // LinkedIn
    linkedin: z
      .object({
        profileUrl: z.string().optional().default(''),
        message: z.string().optional().default(''),
        status: z.string().optional().default('not_contacted'),
        contactedAt: z.any().optional().nullable(),
      })
      .nullish()
      .transform((v) => v || {}),

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
      .nullish()
      .transform((v) => v || {}),

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
