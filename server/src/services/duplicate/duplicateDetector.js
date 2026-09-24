import { Job } from '../../models/Job.js';
import { Contact } from '../../models/Contact.js';

/**
 * Normalizes an email address for comparison: lowercase and trim whitespace.
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Normalizes a URL for comparison: trims whitespace, strips trailing slash and protocols.
 */
export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

/**
 * Generates a normalized duplicate key for a job listing:
 * company + role + normalized job URL
 */
export function generateJobKey(company, role, jobUrl = '') {
  const normCompany = (company || '').trim().toLowerCase();
  const normRole = (role || '').trim().toLowerCase();
  const normUrl = normalizeUrl(jobUrl);
  return `${normCompany}::${normRole}::${normUrl}`;
}

/**
 * Checks whether a job or contact is already known.
 * Returns: { isDuplicate: boolean, reason?: string, existingJob?: Job, existingContact?: Contact }
 */
export async function checkDuplicate({ company, role, hrEmail, jobUrl }) {
  const normalizedHrEmail = normalizeEmail(hrEmail);
  const normalizedJobKey = generateJobKey(company, role, jobUrl);

  // 1. Check if Contact already exists
  const existingContact = await Contact.findOne({ email: normalizedHrEmail });
  if (existingContact) {
    if (existingContact.totalEmailsSent > 0) {
      return {
        isDuplicate: true,
        reason: `HR Email (${normalizedHrEmail}) has already received ${existingContact.totalEmailsSent} application(s). Last sent: ${existingContact.lastContactedAt ? new Date(existingContact.lastContactedAt).toLocaleDateString() : 'N/A'}`,
        existingContact,
      };
    }
  }

  // 2. Check if a Job with this normalized HR email already exists
  const existingJobByEmail = await Job.findOne({
    normalizedHrEmail,
    status: { $in: ['SENT', 'APPROVED', 'QUEUED', 'SENDING', 'REVIEW', 'NEW'] },
  });

  if (existingJobByEmail) {
    return {
      isDuplicate: true,
      reason: `HR Email (${normalizedHrEmail}) already exists in Job #${existingJobByEmail._id} for "${existingJobByEmail.company} - ${existingJobByEmail.role}" with status: ${existingJobByEmail.status}`,
      existingJob: existingJobByEmail,
      existingContact,
    };
  }

  // 3. Check if exact company + role + jobUrl already exists
  if (normalizedJobKey) {
    const existingJobByKey = await Job.findOne({
      normalizedJobKey,
      status: { $nin: ['SKIPPED'] },
    });

    if (existingJobByKey) {
      return {
        isDuplicate: true,
        reason: `Duplicate job listing found for "${company}" - "${role}" (${existingJobByKey.status})`,
        existingJob: existingJobByKey,
        existingContact,
      };
    }
  }

  return {
    isDuplicate: false,
    reason: '',
    existingContact,
  };
}

export default {
  normalizeEmail,
  normalizeUrl,
  generateJobKey,
  checkDuplicate,
};
