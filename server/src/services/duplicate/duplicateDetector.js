import { Job } from '../../models/Job.js';
import { Contact } from '../../models/Contact.js';
import { cleanPhoneNumber } from '../personalization/templateEngine.js';

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
export async function checkDuplicate({ company, role, hrEmail, jobUrl, phone }) {
  const normalizedHrEmail = normalizeEmail(hrEmail);
  const normalizedJobKey = generateJobKey(company, role, jobUrl);
  const cleanPhone = cleanPhoneNumber(phone);

  // 1. Check if Contact already exists
  if (normalizedHrEmail) {
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
  }

  // 2. Check if a Job with this normalized HR email already exists
  if (normalizedHrEmail) {
    const existingJobByEmail = await Job.findOne({
      normalizedHrEmail,
      status: { $in: ['SENT', 'APPROVED', 'QUEUED', 'SENDING', 'REVIEW', 'NEW', 'EMAIL_SENT', 'WHATSAPP_SENT'] },
    });

    if (existingJobByEmail) {
      return {
        isDuplicate: true,
        reason: `HR Email (${normalizedHrEmail}) already exists in Job for "${existingJobByEmail.company} - ${existingJobByEmail.role}" with status: ${existingJobByEmail.status}`,
        existingJob: existingJobByEmail,
      };
    }
  }

  // 3. Check if exact company + role + jobUrl already exists
  if (normalizedJobKey) {
    const existingJobByKey = await Job.findOne({
      normalizedJobKey,
      status: { $nin: ['SKIPPED', 'REJECTED'] },
    });

    if (existingJobByKey) {
      return {
        isDuplicate: true,
        reason: `Duplicate job listing found for "${company}" - "${role}" (${existingJobByKey.status})`,
        existingJob: existingJobByKey,
      };
    }
  }

  // 4. Check if HR phone was already contacted on WhatsApp
  if (cleanPhone) {
    const existingJobByPhone = await Job.findOne({
      $or: [{ 'contact.phone': phone }, { 'whatsapp.phone': phone }],
      'whatsapp.status': 'sent',
    });

    if (existingJobByPhone) {
      return {
        isDuplicate: true,
        reason: `HR Phone (${phone}) has already been contacted on WhatsApp for "${existingJobByPhone.company} - ${existingJobByPhone.role}"`,
        existingJob: existingJobByPhone,
      };
    }
  }

  return {
    isDuplicate: false,
    reason: '',
  };
}

export default {
  normalizeEmail,
  normalizeUrl,
  generateJobKey,
  checkDuplicate,
};
