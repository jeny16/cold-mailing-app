import { Job } from '../models/Job.js';
import { Contact } from '../models/Contact.js';
import { EmailLog } from '../models/EmailLog.js';
import { Setting } from '../models/Setting.js';
import {
  personalizeEmail,
  generateWhatsAppMessage,
  cleanPhoneNumber,
  generateWhatsAppUrl,
} from '../services/personalization/templateEngine.js';
import { sendEmail } from '../services/mail/mailService.js';
import { normalizeEmail, generateJobKey, checkDuplicate } from '../services/duplicate/duplicateDetector.js';
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
      if (quickFilter === 'followups_due') {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        query.$or = [
          { 'tracking.nextFollowUpAt': { $ne: null, $lte: endOfToday } },
          { status: 'FOLLOW_UP' },
        ];
        query.status = { $nin: ['REJECTED', 'CLOSED'] };
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
        query.status = { $nin: ['EMAIL_SENT', 'SENT', 'REJECTED', 'CLOSED'] };
      } else if (quickFilter === 'applications_sent') {
        query.$or = [
          { status: { $in: ['EMAIL_SENT', 'WHATSAPP_SENT', 'SENT'] } },
          { 'email.status': 'sent' },
          { 'whatsapp.status': 'sent' },
        ];
      } else if (quickFilter === 'replies') {
        query.status = 'REPLIED';
      } else if (quickFilter === 'interviews') {
        query.status = 'INTERVIEW';
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
  addActivityLog,
  updateJobStatus,
  approveJob,
  skipJob,
  batchApprove,
  batchSkip,
  batchDelete,
  previewEmail,
};
