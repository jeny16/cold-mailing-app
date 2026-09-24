import { z } from 'zod';

export const SingleJobSchema = z.object({
  company: z.string({ required_error: 'Company is required' }).trim().min(1, 'Company cannot be empty'),
  role: z.string({ required_error: 'Role is required' }).trim().min(1, 'Role cannot be empty'),
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
  email: z
    .object({
      to: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
      subject: z.string().optional().nullable().transform((v) => (v ? v.trim() : '')),
      body: z.string().optional().nullable().transform((v) => (v ? v : '')),
    })
    .optional()
    .nullable(),
  contactVerification: z
    .object({
      status: z.string().optional().nullable(),
      reason: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

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
    return { success: true, data: result.data };
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
