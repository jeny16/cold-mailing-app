import { Job } from '../models/Job.js';
import { Contact } from '../models/Contact.js';
import { EmailLog } from '../models/EmailLog.js';
import { Setting } from '../models/Setting.js';
import {
  personalizeEmail,
  personalizeFollowUpEmail,
  generateWhatsAppMessage,
  cleanPhoneNumber,
  generateWhatsAppUrl,
} from '../services/personalization/templateEngine.js';

import { sendEmail } from '../services/mail/mailService.js';
import {
  normalizeEmail,
  generateJobKey,
  checkDuplicate,
  cleanupDuplicates,
  getDuplicateStats,
} from '../services/duplicate/duplicateDetector.js';
import { validateSingleJob } from '../validators/jobValidator.js';
import logger from '../config/logger.js';

/**
 * List jobs with CRM filters, quick-views, search, and pagination.
 */
export async function getJobs(req, res) {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      quickFilter,
      search,
      company,
      role,
      source,
      location,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Standard status filter
    if (status && status !== 'ALL') {
      if (status.includes(',')) {
        query.status = { $in: status.split(',').map((s) => s.trim()) };
      } else {
        query.status = status;
      }
    }

    // Quick views
    if (quickFilter) {
      const now = new Date();
      if (quickFilter === 'followups_due' || quickFilter === 'followups') {
        query.$or = [
          { status: { $in: ['FOLLOW_UP', 'FOLLOW_UP_1_DUE', 'FOLLOW_UP_1_SENT', 'FOLLOW_UP_2_DUE', 'FOLLOW_UP_2_SENT'] } },
          { 'tracking.nextFollowUpAt': { $ne: null } },
        ];
        query.status = { $nin: ['REJECTED', 'CLOSED', 'NO_REQUIREMENT', 'NO_FOLLOW_UP', 'BOUNCED'] };
      } else if (quickFilter === 'whatsapp_pending') {
        query.$or = [
          { status: 'WHATSAPP_PENDING' },
          {
            'whatsapp.status': { $in: ['not_sent', 'copied'] },
            $or: [{ 'contact.phone': { $ne: '' } }, { 'whatsapp.phone': { $ne: '' } }],
          },
        ];
        query.status = { $nin: ['REJECTED', 'CLOSED', 'WHATSAPP_SENT'] };
      } else if (quickFilter === 'emails_pending') {
        query.$or = [
          { 'email.status': 'not_sent' },
          { status: { $in: ['NEW', 'READY_TO_CONTACT', 'REVIEW', 'RESEARCHED', 'APPROVED'] } },
        ];
        query.status = { $nin: ['EMAIL_SENT', 'SENT', 'REJECTED', 'CLOSED', 'BOUNCED'] };
      } else if (quickFilter === 'applications_sent') {
        query.$or = [
          {
            status: {
              $in: [
                'EMAIL_SENT',
                'WHATSAPP_SENT',
                'SENT',
                'FOLLOW_UP_1_DUE',
                'FOLLOW_UP_1_SENT',
                'FOLLOW_UP_2_DUE',
                'FOLLOW_UP_2_SENT',
                'FOLLOW_UP',
                'REPLIED',
                'INTERVIEW',
                'NO_REQUIREMENT',
              ],
            },
          },
          { 'email.status': 'sent' },
          { 'whatsapp.status': 'sent' },
        ];
      } else if (quickFilter === 'replies') {
        query.status = 'REPLIED';
      } else if (quickFilter === 'interviews') {
        query.status = 'INTERVIEW';
      } else if (quickFilter === 'no_requirement') {
        query.status = { $in: ['NO_REQUIREMENT', 'NO_FOLLOW_UP'] };
      } else if (quickFilter === 'bounced') {
        query.$or = [
          { status: 'BOUNCED' },
          { 'email.status': 'bounced' },
          { 'contactVerification.status': 'invalid' },
        ];
      }
    }

    if (company) {
      query.company = { $regex: company, $options: 'i' };
    }

    if (role) {
      query.role = { $regex: role, $options: 'i' };
    }

    if (source) {
      query.source = { $regex: source, $options: 'i' };
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      const s = search.trim();
      query.$or = [
        { company: { $regex: s, $options: 'i' } },
        { role: { $regex: s, $options: 'i' } },
        { hrEmail: { $regex: s, $options: 'i' } },
        { hrName: { $regex: s, $options: 'i' } },
        { 'contact.email': { $regex: s, $options: 'i' } },
        { 'contact.hrName': { $regex: s, $options: 'i' } },
        { 'contact.phone': { $regex: s, $options: 'i' } },
        { 'whatsapp.phone': { $regex: s, $options: 'i' } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      jobs,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get single job by ID with linked contact and email logs.
 */
export async function getJobById(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const contact = await Contact.findOne({ email: job.normalizedHrEmail });
    const emailLogs = await EmailLog.find({ jobId: job._id }).sort({ queuedAt: -1 });

    res.json({
      success: true,
      job,
      contact,
      emailLogs,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Manually create a new company/job prospect directly in the CRM.
 */
export async function createJob(req, res) {
  try {
    const validation = validateSingleJob(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors,
      });
    }

    const jobData = validation.data;
    const normEmail = normalizeEmail(jobData.hrEmail);
    const normKey = generateJobKey(jobData.company, jobData.role, jobData.jobUrl);

    // Duplicate check
    const dupCheck = await checkDuplicate({
      company: jobData.company,
      role: jobData.role,
      hrEmail: jobData.hrEmail,
      jobUrl: jobData.jobUrl,
      phone: jobData.contact?.phone,
    });

    const settings = await Setting.getSettings();

    // Auto-generate WhatsApp message if blank
    if (!jobData.whatsapp?.message || jobData.whatsapp.message.trim().length === 0) {
      jobData.whatsapp.message = generateWhatsAppMessage(jobData, settings);
    }

    // Auto-generate Email subject & body if blank
    if (!jobData.email?.subject || !jobData.email?.body) {
      const rendered = personalizeEmail(jobData, settings);
      if (!jobData.email.subject) jobData.email.subject = rendered.subject;
      if (!jobData.email.body) jobData.email.body = rendered.textBody;
      if (!jobData.email.to) jobData.email.to = jobData.hrEmail;
    }

    const initialStatus = jobData.status || (dupCheck.isDuplicate ? 'REVIEW' : 'READY_TO_CONTACT');

    const job = await Job.create({
      company: jobData.company,
      role: jobData.role,
      jobType: jobData.jobType || 'specific_opening',
      hrName: jobData.hrName,
      hrEmail: jobData.hrEmail,
      normalizedHrEmail: normEmail,
      jobUrl: jobData.jobUrl,
      normalizedJobKey: normKey,
      source: jobData.source || 'Manual Entry',
      location: jobData.location,
      remote: jobData.remote,
      description: jobData.description,
      requirements: jobData.requirements,
      notes: jobData.notes,
      contact: jobData.contact,
      job: jobData.job,
      email: jobData.email,
      whatsapp: jobData.whatsapp,
      linkedin: jobData.linkedin,
      tracking: {
        status: initialStatus,
        createdAt: new Date(),
        notes: jobData.notes || '',
      },
      timeline: [
        {
          action: 'COMPANY_CREATED',
          title: 'Company Added to CRM',
          description: `Created manually for ${jobData.company} (${jobData.role})`,
          createdAt: new Date(),
        },
      ],
      status: initialStatus,
      isDuplicate: dupCheck.isDuplicate,
      duplicateReason: dupCheck.reason || '',
    });

    // Upsert Contact
    try {
      let contact = await Contact.findOne({ email: normEmail });
      if (!contact) {
        contact = await Contact.create({
          email: normEmail,
          name: jobData.hrName || jobData.contact?.hrName || '',
          company: jobData.company,
          phone: jobData.contact?.phone || '',
          whatsapp: jobData.contact?.whatsapp || '',
          linkedin: jobData.contact?.linkedin || '',
          jobs: [job._id],
        });
      } else {
        if (jobData.contact?.phone && !contact.phone) contact.phone = jobData.contact.phone;
        if (jobData.contact?.whatsapp && !contact.whatsapp) contact.whatsapp = jobData.contact.whatsapp;
        if (jobData.contact?.linkedin && !contact.linkedin) contact.linkedin = jobData.contact.linkedin;
        if (!contact.jobs) contact.jobs = [];
        if (!contact.jobs.some((jId) => jId.toString() === job._id.toString())) {
          contact.jobs.push(job._id);
        }
        await contact.save();
      }
    } catch (contactErr) {
      logger.warn({ err: contactErr.message }, '[Job] Contact upsert notice');
    }

    res.status(201).json({
      success: true,
      message: 'Company prospect added successfully',
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update an existing job.
 */
export async function updateJob(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.hrEmail) {
      updates.normalizedHrEmail = normalizeEmail(updates.hrEmail);
    }
    if (updates.company || updates.role || updates.jobUrl) {
      const current = await Job.findById(id);
      if (current) {
        const company = updates.company || current.company;
        const role = updates.role || current.role;
        const jobUrl = updates.jobUrl !== undefined ? updates.jobUrl : current.jobUrl;
        updates.normalizedJobKey = generateJobKey(company, role, jobUrl);
      }
    }

    const updated = await Job.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({ success: true, job: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Delete a job.
 */
export async function deleteJob(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Job.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Send single email immediately via Node mail service.
 * Follows the user's recommended workflow:
 * Load Job -> Load Email Subject -> Load Email Body -> Attach Resume -> SMTP -> Send -> Update status -> EMAIL_SENT
 * And saves: { status: "sent", sentAt: "...", messageId: "..." }
 */
export async function sendSingleJobEmail(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const recipient = (job.contact?.email || job.hrEmail || '').trim();
    if (!recipient || !recipient.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid recipient email is required' });
    }

    const settings = await Setting.getSettings();

    // Determine subject & body
    let subject = job.email?.subject?.trim();
    let textBody = job.email?.body?.trim();

    if (!subject || !textBody) {
      const rendered = personalizeEmail(job, settings);
      subject = subject || rendered.subject;
      textBody = textBody || rendered.textBody;
    }

    const htmlBody = textBody
      .split('\n\n')
      .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    // Send email via mailService
    const sendResult = await sendEmail({
      to: recipient,
      subject,
      htmlBody,
      textBody,
      customResumePath: settings.resumePath,
      isTest: false,
    });

    // Update Contact
    const normEmail = recipient.toLowerCase();
    let contact = await Contact.findOne({ email: normEmail });
    if (contact) {
      contact.lastContactedAt = new Date();
      contact.totalEmailsSent = (contact.totalEmailsSent || 0) + 1;
      await contact.save();
    }

    // Record in EmailLog
    await EmailLog.create({
      jobId: job._id,
      contactId: contact ? contact._id : null,
      recipient,
      subject,
      body: htmlBody,
      status: 'SENT',
      sentAt: new Date(),
      messageId: sendResult.messageId,
      isDryRun: sendResult.isDryRun,
      hasAttachment: sendResult.hasAttachment,
      attachmentName: sendResult.attachmentName || 'resume.pdf',
    });

    // Update Job document
    job.email = {
      to: recipient,
      subject,
      body: textBody,
      status: 'sent',
      sentAt: new Date(),
      messageId: sendResult.messageId || 'sent',
    };
    job.status = 'EMAIL_SENT';
    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'EMAIL_SENT';
    job.tracking.lastContactedAt = new Date();
    job.sentAt = new Date();

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'EMAIL_SENT',
      title: 'Email Sent',
      description: `Dispatched application to ${recipient} (Subject: "${subject}")`,
      createdAt: new Date(),
      meta: { messageId: sendResult.messageId, isDryRun: sendResult.isDryRun },
    });

    await job.save();

    res.json({
      success: true,
      message: sendResult.isDryRun
        ? 'Email processed in DRY RUN mode (no external email sent)'
        : `Email dispatched successfully to ${recipient}`,
      job,
      sendResult,
    });
  } catch (error) {
    logger.error({ err: error.message }, '[Job] Single email send failed');
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Records that a WhatsApp message was copied to clipboard.
 */
export async function copyWhatsAppData(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (!job.whatsapp) job.whatsapp = {};
    job.whatsapp.status = 'copied';
    job.whatsapp.copiedAt = new Date();

    if (job.status === 'NEW' || job.status === 'READY_TO_CONTACT') {
      job.status = 'WHATSAPP_PENDING';
      if (!job.tracking) job.tracking = {};
      job.tracking.status = 'WHATSAPP_PENDING';
    }

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'WHATSAPP_COPIED',
      title: 'WhatsApp Message Copied',
      description: 'Outreach message copied to clipboard for manual sending',
      createdAt: new Date(),
    });

    await job.save();

    res.json({
      success: true,
      message: 'WhatsApp status marked as copied',
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Marks a WhatsApp message as sent manually.
 */
export async function markWhatsAppSent(req, res) {
  try {
    const { id } = req.params;
    const { notes, nextFollowUpAt } = req.body;

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const phone = job.contact?.phone || job.whatsapp?.phone || '';

    if (!job.whatsapp) job.whatsapp = {};
    job.whatsapp.status = 'sent';
    job.whatsapp.sentAt = new Date();

    job.status = 'WHATSAPP_SENT';
    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'WHATSAPP_SENT';
    job.tracking.lastContactedAt = new Date();

    if (nextFollowUpAt) {
      job.tracking.nextFollowUpAt = new Date(nextFollowUpAt);
    }

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'WHATSAPP_SENT',
      title: 'WhatsApp Sent',
      description: `Manually sent message to ${phone || 'HR'}${notes ? ` (${notes})` : ''}`,
      createdAt: new Date(),
      meta: { notes, phone },
    });

    // Update Contact totalWhatsAppSent
    const normEmail = (job.hrEmail || '').toLowerCase();
    if (normEmail) {
      await Contact.updateOne(
        { email: normEmail },
        {
          $inc: { totalWhatsAppSent: 1 },
          $set: { lastContactedAt: new Date() },
        }
      );
    }

    await job.save();

    res.json({
      success: true,
      message: 'WhatsApp outreach marked as sent',
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Schedule a follow-up date and note for a job.
 */
export async function scheduleFollowUp(req, res) {
  try {
    const { id } = req.params;
    const { nextFollowUpAt, notes, status = 'FOLLOW_UP' } = req.body;

    if (!nextFollowUpAt) {
      return res.status(400).json({ success: false, error: 'A follow-up date is required' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (!job.tracking) job.tracking = {};
    job.tracking.nextFollowUpAt = new Date(nextFollowUpAt);
    job.tracking.followUpCount = (job.tracking.followUpCount || 0) + 1;
    if (notes) job.tracking.notes = notes;

    job.status = status;
    job.tracking.status = status;

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'FOLLOWUP_SCHEDULED',
      title: 'Follow-up Scheduled',
      description: `Follow-up set for ${new Date(nextFollowUpAt).toLocaleDateString()}${notes ? `: ${notes}` : ''}`,
      createdAt: new Date(),
      meta: { nextFollowUpAt, notes },
    });

    await job.save();

    res.json({
      success: true,
      message: 'Follow-up scheduled successfully',
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Add a custom note / call log / activity to the Job's timeline.
 */
export async function addActivityLog(req, res) {
  try {
    const { id } = req.params;
    const { action = 'NOTE_ADDED', title = 'Note Logged', description = '', newStatus, meta = {} } = req.body;

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    if (newStatus) {
      job.status = newStatus;
      if (!job.tracking) job.tracking = {};
      job.tracking.status = newStatus;
      if (['REPLIED', 'INTERVIEW', 'EMAIL_SENT', 'WHATSAPP_SENT'].includes(newStatus)) {
        job.tracking.lastContactedAt = new Date();
      }
    }

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action,
      title,
      description,
      createdAt: new Date(),
      meta,
    });

    await job.save();

    res.json({
      success: true,
      message: 'Activity recorded in contact history',
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update CRM status with automatic timeline logging.
 */
export async function updateJobStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const oldStatus = job.status;
    job.status = status;
    if (!job.tracking) job.tracking = {};
    job.tracking.status = status;

    if (['REPLIED', 'INTERVIEW', 'EMAIL_SENT', 'WHATSAPP_SENT'].includes(status)) {
      job.tracking.lastContactedAt = new Date();
    }

    if (status === 'BOUNCED') {
      if (!job.email) job.email = {};
      job.email.status = 'bounced';
      job.contactVerification = {
        status: 'invalid',
        reason: notes || 'Marked as BOUNCED',
      };
      const normEmail = (job.contact?.email || job.hrEmail || '').trim().toLowerCase();
      if (normEmail) {
        await Contact.updateOne({ email: normEmail }, { $set: { status: 'BOUNCED' } });
      }
    }

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'STATUS_CHANGED',
      title: `Status changed to ${status}`,
      description: notes || `Transitioned from ${oldStatus} to ${status}`,
      createdAt: new Date(),
      meta: { oldStatus, newStatus: status, notes },
    });

    await job.save();

    res.json({
      success: true,
      message: `Status updated to ${status}`,
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Approve a job for the queue.
 */
export async function approveJob(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    job.status = 'APPROVED';
    job.approvedAt = new Date();
    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'APPROVED';

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'APPROVED',
      title: 'Job Approved',
      description: 'Approved for sending queue',
      createdAt: new Date(),
    });

    await job.save();

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Skip a job.
 */
export async function skipJob(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    job.status = 'SKIPPED';
    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'SKIPPED';

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'SKIPPED',
      title: 'Job Skipped',
      description: 'Prospect marked as skipped',
      createdAt: new Date(),
    });

    await job.save();

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Batch approve jobs.
 */
export async function batchApprove(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of job ids is required' });
    }

    const result = await Job.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'APPROVED', approvedAt: new Date(), 'tracking.status': 'APPROVED' } }
    );

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Batch skip jobs.
 */
export async function batchSkip(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of job ids is required' });
    }

    const result = await Job.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'SKIPPED', 'tracking.status': 'SKIPPED' } }
    );

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Batch delete jobs.
 */
export async function batchDelete(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of job ids is required' });
    }

    const result = await Job.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Preview email with variables and resume path.
 */
export async function previewEmail(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const settings = await Setting.getSettings();
    const rendered = personalizeEmail(job, settings);
    const whatsappMessage = generateWhatsAppMessage(job, settings);
    const cleanPhone = cleanPhoneNumber(job.contact?.phone || job.whatsapp?.phone);
    const whatsappUrl = cleanPhone ? generateWhatsAppUrl(cleanPhone, whatsappMessage) : '';

    res.json({
      success: true,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
      recipient: job.contact?.email || job.hrEmail,
      recipientName: job.contact?.hrName || job.hrName || 'Hiring Team',
      resumePath: settings.resumePath,
      whatsapp: {
        phone: cleanPhone,
        message: whatsappMessage,
        url: whatsappUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Triggers duplicate purge across the CRM jobs collection.
 */
export async function cleanupDuplicatesController(req, res) {
  try {
    const result = await cleanupDuplicates();
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, '[Jobs] Error cleaning duplicates');
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Returns duplicate statistics for UI badges.
 */
export async function getDuplicateStatsController(req, res) {
  try {
    const stats = await getDuplicateStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Mark a specific job as BOUNCED with error reasoning
 */
export async function markJobBounced(req, res) {
  try {
    const { id } = req.params;
    const { reason = '550 5.1.1 User does not exist - Address not found', rawError = '' } = req.body;

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const email = (job.contact?.email || job.hrEmail || '').trim().toLowerCase();
    const bounceReason = reason || rawError || '550 5.1.1 User does not exist - Address not found';

    job.status = 'BOUNCED';
    if (!job.email) job.email = {};
    job.email.status = 'bounced';
    job.contactVerification = {
      status: 'invalid',
      reason: bounceReason,
    };
    job.lastError = bounceReason;

    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'BOUNCED';
    job.tracking.notes = (job.tracking.notes ? job.tracking.notes + '\n' : '') + `[BOUNCED] ${bounceReason}`;

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'EMAIL_BOUNCED',
      title: 'Email Delivery Failed / Bounced',
      description: `Delivery failed to ${email || 'HR'}: ${bounceReason}`,
      createdAt: new Date(),
      meta: {
        recipient: email,
        reason: bounceReason,
        rawError,
      },
    });

    await job.save();

    if (email) {
      await Contact.updateOne(
        { email },
        {
          $set: {
            status: 'BOUNCED',
            notes: `[${new Date().toISOString()}] Email bounced: ${bounceReason}`,
          },
        }
      );

      await EmailLog.updateMany(
        { recipient: email },
        {
          $set: {
            status: 'FAILED',
            error: `Bounced: ${bounceReason}`,
          },
        }
      );
    }

    res.json({
      success: true,
      message: `Marked "${job.company}" as BOUNCED (${bounceReason})`,
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Mark a company / job as NO_REQUIREMENT (permanently suppresses automated follow-up).
 */
export async function markNoRequirement(req, res) {
  try {
    const { id } = req.params;
    const { notes = 'HR replied that there is no active opening or requirement.' } = req.body || {};

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    job.status = 'NO_REQUIREMENT';
    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'NO_REQUIREMENT';
    job.tracking.nextFollowUpAt = null; // Permanently suppress follow-up!
    job.tracking.notes = notes;

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'NO_REQUIREMENT_RECORDED',
      title: 'HR: No Opening / No Requirement',
      description: notes,
      createdAt: new Date(),
      meta: { notes, suppressed: true },
    });

    await job.save();

    res.json({
      success: true,
      message: `Marked "${job.company}" as NO_REQUIREMENT (follow-ups permanently suppressed)`,
      job,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Sends a standardized follow-up email directly to the HR contact.
 */
export async function sendFollowUpEmail(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const recipient = (job.contact?.email || job.hrEmail || '').trim();
    if (!recipient || !recipient.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid recipient email is required' });
    }

    // Safety guard: do not send follow-up to bounced or no-requirement contacts
    if (['BOUNCED', 'INVALID_EMAIL', 'NO_REQUIREMENT', 'NO_FOLLOW_UP', 'REJECTED', 'CLOSED'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot send follow-up: Job is currently marked as ${job.status}`,
      });
    }

    const settings = await Setting.getSettings();
    const rendered = personalizeFollowUpEmail(job, settings);

    const subject = req.body?.subject || rendered.subject;
    const textBody = req.body?.body || rendered.textBody;
    const htmlBody = textBody
      .split('\n\n')
      .map((p) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const sendResult = await sendEmail({
      to: recipient,
      subject,
      htmlBody,
      textBody,
      customResumePath: settings.resumePath,
      isTest: false,
    });

    // Update Contact
    const normEmail = recipient.toLowerCase();
    let contact = await Contact.findOne({ email: normEmail });
    if (contact) {
      contact.lastContactedAt = new Date();
      contact.totalEmailsSent = (contact.totalEmailsSent || 0) + 1;
      await contact.save();
    }

    // Record in EmailLog
    await EmailLog.create({
      jobId: job._id,
      contactId: contact ? contact._id : null,
      recipient,
      subject,
      body: htmlBody,
      status: 'SENT',
      sentAt: new Date(),
      messageId: sendResult.messageId,
      isDryRun: sendResult.isDryRun,
      hasAttachment: sendResult.hasAttachment,
      attachmentName: sendResult.attachmentName || 'resume.pdf',
    });

    // Determine next follow-up status & cadence (3 days, then 5-7 days, then stop)
    const currentFollowUpCount = (job.tracking?.followUpCount || 0) + 1;
    let nextStatus = 'FOLLOW_UP_1_SENT';
    let nextFollowUpDate = null;

    if (currentFollowUpCount >= 2) {
      nextStatus = 'FOLLOW_UP_2_SENT';
      // After 2 follow-ups, stop scheduling further follow-ups
      nextFollowUpDate = null;
    } else {
      nextStatus = 'FOLLOW_UP_1_SENT';
      // Schedule follow-up 2 due in 6 calendar days
      nextFollowUpDate = new Date();
      nextFollowUpDate.setDate(nextFollowUpDate.getDate() + 6);
    }

    job.status = nextStatus;
    if (!job.tracking) job.tracking = {};
    job.tracking.status = nextStatus;
    job.tracking.lastContactedAt = new Date();
    job.tracking.followUpCount = currentFollowUpCount;
    job.tracking.nextFollowUpAt = nextFollowUpDate;

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'FOLLOW_UP_SENT',
      title: `Follow-up ${currentFollowUpCount} Sent via Email`,
      description: `Follow-up email sent to ${recipient} (Subject: "${subject}")`,
      createdAt: new Date(),
      meta: {
        messageId: sendResult.messageId,
        followUpCount: currentFollowUpCount,
        nextFollowUpAt: nextFollowUpDate,
        isDryRun: sendResult.isDryRun,
      },
    });

    await job.save();

    res.json({
      success: true,
      message: `Follow-up ${currentFollowUpCount} email sent to ${recipient}`,
      job,
      nextFollowUpAt: nextFollowUpDate,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Applies the standardized follow-up plan based on the user's verified sending log.
 */
export async function applyFollowUpPlan(req, res) {
  try {
    const SPECIFIC_FOLLOW_UPS = [
      { name: 'EncodeDots', date: '2026-09-30' },
      { name: 'Innovative Glance', date: '2026-09-29', emailFilter: 'hello@' },
      { name: 'Vrinsoft', date: '2026-09-29' },
      { name: 'Briskstar', date: '2026-09-29' },
      { name: 'PixScale', date: '2026-09-29' },
      { name: 'Patel-Apps', date: '2026-09-29' },
      { name: 'SandCup', date: '2026-09-29' },
      { name: 'NetFillip', date: '2026-09-29' },
      { name: 'RiseoTech', date: '2026-09-29' },
      { name: 'TM Systems', date: '2026-09-29' },
      { name: 'Sweken', date: '2026-09-29' },
      { name: 'TechIntact', date: '2026-09-29' },
      { name: 'Webs Optimization', date: '2026-09-29' },
      { name: 'Evoort Solutions', date: '2026-09-29' },
      { name: 'TriState', date: '2026-09-29' },
      { name: 'Aipxperts', date: '2026-09-29' },
      { name: 'Openskale', date: '2026-09-29' },
      { name: 'CCTech', date: '2026-09-29' },
      { name: 'Multitrade Softech', date: '2026-09-29' },
      { name: 'Syndell Technologies', date: '2026-09-29' },
      { name: 'HyperScale Systems', date: '2026-09-29' },
    ];

    const GENERAL_COMPANIES = [
      'WebAppHealing', 'Saturncube', 'Codage Habitation', 'De Soto Technologies',
      'Implies Solution', 'Xopple Infotech', 'Emipro', 'DIT Interactive',
      'Inextrix Technologies', 'Saleshandy', 'Sprybit', '56N Software',
      'Siyana Info Solutions', 'Pixelque Software', 'Shine Infosoft', 'Ivalue Systech',
      'KBA Systems', 'Superworks', 'Aims Infosoft', 'Uniqual Itech',
      'Propelius Technologies', 'Xomic Infotech', 'Appitsimple Infotek', 'Qable',
      'Brilworks Software', 'Ishitva Robotic Systems'
    ];

    let specificUpdated = 0;
    for (const item of SPECIFIC_FOLLOW_UPS) {
      const query = { company: { $regex: item.name, $options: 'i' } };
      if (item.emailFilter) {
        query.hrEmail = { $regex: item.emailFilter, $options: 'i' };
      }
      const dueDate = new Date(`${item.date}T10:00:00+05:30`);
      const result = await Job.updateMany(
        query,
        {
          $set: {
            jobType: 'specific_opening',
            status: 'FOLLOW_UP_1_DUE',
            'tracking.status': 'FOLLOW_UP_1_DUE',
            'tracking.nextFollowUpAt': dueDate,
          },
        }
      );
      specificUpdated += result.modifiedCount;
    }

    let generalUpdated = 0;
    for (const comp of GENERAL_COMPANIES) {
      const result = await Job.updateMany(
        { company: { $regex: comp.split(' ')[0], $options: 'i' } },
        {
          $set: {
            jobType: 'general_inquiry',
            'tracking.nextFollowUpAt': null, // Suppress automated follow-ups for general inquiries
          },
        }
      );
      generalUpdated += result.modifiedCount;
    }

    // Suppress follow-ups on known bounced addresses
    const bouncedResult = await Job.updateMany(
      {
        $or: [
          { status: 'BOUNCED' },
          { hrEmail: { $in: ['careers@novasolutions.tech', 'careers@novasolutions.com', 'careers@innovativeglance.com', 'dev@ansorbit.com', 'careers@zenithcloudlabs.com', 'pooja.patel@zenithcloud.io'] } }
        ]
      },
      {
        $set: {
          status: 'BOUNCED',
          'tracking.status': 'BOUNCED',
          'tracking.nextFollowUpAt': null,
        }
      }
    );

    res.json({
      success: true,
      message: 'Follow-up plan successfully synchronized with CRM',
      specificUpdated,
      generalUpdated,
      bouncedSuppressed: bouncedResult.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  sendSingleJobEmail,
  copyWhatsAppData,
  markWhatsAppSent,
  scheduleFollowUp,
  markNoRequirement,
  sendFollowUpEmail,
  applyFollowUpPlan,
  addActivityLog,
  updateJobStatus,
  approveJob,
  skipJob,
  batchApprove,
  batchSkip,
  batchDelete,
  previewEmail,
  cleanupDuplicatesController,
  getDuplicateStatsController,
  markJobBounced,
};

