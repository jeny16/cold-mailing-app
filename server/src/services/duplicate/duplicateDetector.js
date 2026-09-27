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
      if (existingContact.status === 'BOUNCED') {
        return {
          isDuplicate: true,
          isBounced: true,
          reason: `HR Email (${normalizedHrEmail}) previously BOUNCED / is marked invalid. Delivery will fail.`,
          existingContact,
        };
      }
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
      status: { $in: ['SENT', 'APPROVED', 'QUEUED', 'SENDING', 'REVIEW', 'NEW', 'EMAIL_SENT', 'WHATSAPP_SENT', 'BOUNCED'] },
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

/**
 * Returns duplicate statistics across the entire Job collection.
 */
export async function getDuplicateStats() {
  const explicitDupCount = await Job.countDocuments({ isDuplicate: true });

  const duplicatesByCompanyRole = await Job.aggregate([
    {
      $group: {
        _id: {
          company: { $toLower: { $trim: { input: '$company' } } },
          role: { $toLower: { $trim: { input: '$role' } } },
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  let redundantCount = 0;
  for (const group of duplicatesByCompanyRole) {
    redundantCount += group.count - 1;
  }

  const totalDuplicates = Math.max(explicitDupCount, redundantCount);

  return {
    totalDuplicates,
    duplicateGroupsCount: duplicatesByCompanyRole.length,
    explicitDuplicates: explicitDupCount,
  };
}

/**
 * Cleans up existing duplicate job records in the database:
 * Retains the primary record (highest activity / original) and removes redundant duplicates.
 */
export async function cleanupDuplicates() {
  const allJobs = await Job.find({}).sort({ createdAt: 1 });

  // Map to group duplicate jobs
  const groupMap = new Map();

  for (const job of allJobs) {
    const normCompany = (job.company || '').trim().toLowerCase();
    const normRole = (job.role || '').trim().toLowerCase();
    const companyRoleKey = `${normCompany}::${normRole}`;

    let groupKey = companyRoleKey;
    const normEmail = (job.normalizedHrEmail || '').trim().toLowerCase();
    if (
      normEmail &&
      !normEmail.includes('prospect.com') &&
      !normEmail.includes('company.com')
    ) {
      groupKey = `email::${normEmail}`;
    }

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey).push(job);
  }

  const idsToDelete = [];
  const details = [];

  for (const [key, jobsList] of groupMap.entries()) {
    if (jobsList.length <= 1) continue;

    // Score jobs to pick the best master to keep
    const scoredJobs = jobsList.map((job) => {
      let score = 0;
      if (['REPLIED', 'INTERVIEW'].includes(job.status)) score += 300;
      else if (['EMAIL_SENT', 'WHATSAPP_SENT', 'SENT'].includes(job.status)) score += 200;
      else if (job.status === 'READY_TO_CONTACT') score += 100;
      else if (job.status === 'QUEUED') score += 80;
      else if (job.status === 'NEW') score += 50;
      else if (job.status === 'REVIEW') score += 10;

      if (job.email?.status === 'sent') score += 100;
      if (job.whatsapp?.status === 'sent') score += 100;
      score += (job.timeline?.length || 0) * 10;
      if (job.contact?.phone || job.whatsapp?.phone) score += 20;
      if (!job.isDuplicate) score += 50;

      return { job, score };
    });

    // Sort descending by score, and break ties by earliest createdAt
    scoredJobs.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.job.createdAt) - new Date(b.job.createdAt);
    });

    const master = scoredJobs[0].job;
    const duplicates = scoredJobs.slice(1);

    for (const dup of duplicates) {
      idsToDelete.push(dup.job._id);
    }

    details.push({
      company: master.company,
      role: master.role,
      keptId: master._id,
      removedCount: duplicates.length,
    });
  }

  // Also include any explicitly flagged isDuplicate jobs where another matching job exists
  const explicitDuplicates = await Job.find({
    isDuplicate: true,
    _id: { $nin: idsToDelete },
  });

  for (const ed of explicitDuplicates) {
    const normCompany = (ed.company || '').trim().toLowerCase();
    const other = await Job.findOne({
      _id: { $ne: ed._id, $nin: idsToDelete },
      company: new RegExp(`^${normCompany}$`, 'i'),
    });
    if (other) {
      idsToDelete.push(ed._id);
    }
  }

  let deletedCount = 0;
  if (idsToDelete.length > 0) {
    const delResult = await Job.deleteMany({ _id: { $in: idsToDelete } });
    deletedCount = delResult.deletedCount;

    // Clean up Contact references
    await Contact.updateMany(
      {},
      { $pull: { jobs: { $in: idsToDelete } } }
    );
  }

  const remainingCount = await Job.countDocuments();

  return {
    success: true,
    deletedCount,
    remainingCount,
    details,
    message:
      deletedCount > 0
        ? `Successfully cleaned up ${deletedCount} duplicate job record(s).`
        : 'No duplicate records found to clean up.',
  };
}

export default {
  normalizeEmail,
  normalizeUrl,
  generateJobKey,
  checkDuplicate,
  getDuplicateStats,
  cleanupDuplicates,
};
