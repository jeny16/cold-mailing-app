import { Job } from '../../models/Job.js';
import { Contact } from '../../models/Contact.js';
import { EmailLog } from '../../models/EmailLog.js';
import { Setting } from '../../models/Setting.js';
import { personalizeEmail } from '../personalization/templateEngine.js';
import { sendEmail } from '../mail/mailService.js';
import { validateEmailAddress } from '../../utils/emailValidator.js';
import logger from '../../config/logger.js';

class QueueManager {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentJobId = null;
    this.processPromise = null;
  }

  /**
   * Calculates the number of emails successfully sent today.
   */
  async getSentCountToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await EmailLog.countDocuments({
      status: 'SENT',
      sentAt: { $gte: startOfDay },
    });

    return count;
  }

  /**
   * Recovers jobs that were left in SENDING status on crash/restart.
   */
  async recoverOrphanedJobs() {
    try {
      const result = await Job.updateMany(
        { status: 'SENDING' },
        { $set: { status: 'QUEUED', lastError: 'Recovered from unexpected shutdown' } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[Queue] Recovered ${result.modifiedCount} orphaned sending job(s) back to QUEUED`);
      }
    } catch (err) {
      logger.error({ err: err.message }, '[Queue] Error recovering orphaned jobs');
    }
  }

  /**
   * Helper delay that can be interrupted if queue is paused.
   */
  async sleepInterruptible(seconds) {
    const totalMs = seconds * 1000;
    const intervalMs = 250;
    let elapsed = 0;

    while (elapsed < totalMs) {
      if (this.isPaused) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      elapsed += intervalMs;
    }
  }

  /**
   * Starts or resumes queue processing.
   */
  async startQueue() {
    if (this.isRunning && !this.isPaused) {
      return { status: 'already_running', message: 'Queue is already actively running' };
    }

    this.isPaused = false;
    this.isRunning = true;

    // Convert APPROVED jobs into QUEUED status
    const approvedJobs = await Job.find({ status: 'APPROVED' });
    if (approvedJobs.length > 0) {
      await Job.updateMany(
        { status: 'APPROVED' },
        { $set: { status: 'QUEUED' } }
      );
      logger.info(`[Queue] Enqueued ${approvedJobs.length} approved job(s)`);
    }

    // Trigger background processing asynchronously
    this.processPromise = this.processLoop().catch((err) => {
      logger.error({ err: err.message }, '[Queue] Unhandled error in queue loop');
    });

    return {
      status: 'started',
      message: 'Queue processing started',
    };
  }

  /**
   * Pauses the queue.
   */
  pauseQueue() {
    if (!this.isRunning) {
      return { status: 'idle', message: 'Queue is not running' };
    }
    this.isPaused = true;
    logger.info('[Queue] Queue paused by user');
    return { status: 'paused', message: 'Queue paused' };
  }

  /**
   * Returns current queue operational status.
   */
  async getStatus() {
    const sentToday = await this.getSentCountToday();
    const settings = await Setting.getSettings();
    const queuedCount = await Job.countDocuments({ status: { $in: ['QUEUED', 'SENDING'] } });
    const approvedCount = await Job.countDocuments({ status: 'APPROVED' });
    const failedCount = await Job.countDocuments({ status: 'FAILED' });

    let state = 'IDLE';
    if (this.isRunning) {
      state = this.isPaused ? 'PAUSED' : 'RUNNING';
    }

    return {
      state,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentJobId: this.currentJobId,
      sentToday,
      dailyLimit: settings.dailyLimit,
      remainingToday: Math.max(0, settings.dailyLimit - sentToday),
      queuedCount,
      approvedCount,
      failedCount,
      minDelaySeconds: settings.minDelaySeconds,
      maxDelaySeconds: settings.maxDelaySeconds,
      maxEmailsPerRun: settings.maxEmailsPerRun,
      dryRun: settings.dryRun,
    };
  }

  /**
   * Main sequential processing loop.
   */
  async processLoop() {
    logger.info('[Queue] Processing loop started');

    try {
      const settings = await Setting.getSettings();
      let emailsSentInThisRun = 0;

      while (this.isRunning && !this.isPaused) {
        // 1. Check daily limit
        const sentToday = await this.getSentCountToday();
        if (sentToday >= settings.dailyLimit) {
          logger.warn(`[Queue] Daily email limit reached (${sentToday}/${settings.dailyLimit}). Pausing queue.`);
          this.isPaused = true;
          this.isRunning = false;
          break;
        }

        // 2. Check max emails per run
        if (emailsSentInThisRun >= settings.maxEmailsPerRun) {
          logger.info(`[Queue] Max emails per run reached (${emailsSentInThisRun}/${settings.maxEmailsPerRun}). Stopping run.`);
          this.isRunning = false;
          break;
        }

        // 3. Fetch next candidate job
        const job = await Job.findOne({ status: 'QUEUED' }).sort({ importedAt: 1 });
        if (!job) {
          logger.info('[Queue] No more queued jobs to process. Queue complete.');
          this.isRunning = false;
          break;
        }

        this.currentJobId = job._id;

        // 4. Process single job
        try {
          await this.processSingleJob(job, settings);
          emailsSentInThisRun++;
        } catch (jobErr) {
          logger.error({ jobId: job._id, err: jobErr.message }, '[Queue] Job failed, continuing to next job');
        }

        this.currentJobId = null;

        // 5. Check if another job is waiting before applying delay
        const hasMore = await Job.exists({ status: 'QUEUED' });
        if (hasMore && this.isRunning && !this.isPaused && emailsSentInThisRun < settings.maxEmailsPerRun) {
          const minDelay = Math.max(1, settings.minDelaySeconds || 5);
          const maxDelay = Math.max(minDelay, settings.maxDelaySeconds || 15);
          const delaySec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

          logger.info(`[Queue] Waiting ${delaySec}s before sending next email...`);
          await this.sleepInterruptible(delaySec);
        }
      }
    } finally {
      this.isRunning = false;
      this.currentJobId = null;
      logger.info('[Queue] Processing loop ended');
    }
  }

  /**
   * Processes a single job: renders email, sends, records logs, updates contact.
   */
  async processSingleJob(job, settings) {
    logger.info({ jobId: job._id, company: job.company, hrEmail: job.hrEmail }, '[Queue] Processing job');

    // Mark as SENDING
    job.status = 'SENDING';
    await job.save();

    // Prepare or find Contact
    const normEmail = (job.hrEmail || '').trim().toLowerCase();
    let contact = await Contact.findOne({ email: normEmail });
    if (!contact) {
      contact = await Contact.create({
        email: normEmail,
        name: job.hrName || '',
        company: job.company || '',
        totalEmailsSent: 0,
      });
    }

    // Safety guard 1: do not send to known bounced addresses or invalid contacts
    if (contact.status === 'BOUNCED' || job.status === 'BOUNCED' || job.contactVerification?.status === 'invalid') {
      logger.warn({ jobId: job._id, email: normEmail }, '[Queue] Skipping send to known BOUNCED/invalid contact');
      job.status = 'SKIPPED';
      job.lastError = 'Skipped: Recipient email is marked as BOUNCED / invalid';
      await job.save();
      return { skipped: true, reason: 'Recipient is marked as BOUNCED' };
    }

    // Safety guard 2: Active DNS MX pre-check to prevent sending to dead domains (e.g. SERVFAIL / no MX)
    const emailValidation = await validateEmailAddress(normEmail, { checkMx: true });
    if (!emailValidation.valid && emailValidation.mxDetails?.hasMx === false) {
      const failReason = emailValidation.reason || `Domain "${emailValidation.domain}" has no valid MX records`;
      logger.warn(
        { jobId: job._id, email: normEmail, reason: failReason },
        '[Queue] Pre-send DNS MX check failed. Removing invalid recipient from queue.'
      );

      job.status = 'BOUNCED';
      job.lastError = failReason;
      if (!job.contactVerification) job.contactVerification = {};
      job.contactVerification.status = 'invalid';
      job.contactVerification.reason = failReason;

      if (!job.tracking) job.tracking = {};
      job.tracking.status = 'BOUNCED';
      job.tracking.notes = (job.tracking.notes ? job.tracking.notes + '\n' : '') + `[PRE-SEND DNS FAILED] ${failReason}`;

      if (!job.timeline) job.timeline = [];
      job.timeline.push({
        action: 'EMAIL_BOUNCED',
        title: 'Pre-Send DNS MX Check Failed',
        description: `Recipient domain verification failed: ${failReason}. Blocked and removed from queue to prevent delivery retry loops.`,
        createdAt: new Date(),
        meta: { email: normEmail, reason: failReason, isPreSendBlock: true },
      });
      await job.save();

      contact.status = 'BOUNCED';
      contact.notes = `DNS MX check failed: ${failReason}`;
      await contact.save();

      return { skipped: true, reason: failReason };
    }

    // Render personalized email
    const { subject, htmlBody, textBody } = personalizeEmail(job, settings);

    // Create EmailLog entry in SENDING status
    const emailLog = await EmailLog.create({
      jobId: job._id,
      contactId: contact._id,
      recipient: normEmail,
      subject,
      body: htmlBody,
      status: 'SENDING',
      queuedAt: new Date(),
      isDryRun: settings.dryRun,
    });

    try {
      // Send email via mailService
      const sendResult = await sendEmail({
        to: normEmail,
        subject,
        htmlBody,
        textBody,
        customResumePath: settings.resumePath,
        isTest: false,
      });

      // Update Contact
      contact.lastContactedAt = new Date();
      if (!contact.firstContactedAt) {
        contact.firstContactedAt = new Date();
      }
      contact.totalEmailsSent += 1;
      await contact.save();

      // Update EmailLog
      emailLog.status = 'SENT';
      emailLog.sentAt = new Date();
      emailLog.messageId = sendResult.messageId;
      emailLog.isDryRun = sendResult.isDryRun;
      emailLog.hasAttachment = sendResult.hasAttachment;
      emailLog.attachmentName = sendResult.attachmentName || 'resume.pdf';
      await emailLog.save();

      // Update Job
      job.status = 'EMAIL_SENT';
      job.sentAt = new Date();
      job.lastError = '';

      if (!job.email) job.email = {};
      job.email.status = 'sent';
      job.email.sentAt = new Date();
      job.email.messageId = sendResult.messageId || '';

      if (!job.tracking) job.tracking = {};
      job.tracking.status = 'EMAIL_SENT';
      job.tracking.lastContactedAt = new Date();

      if (!job.timeline) job.timeline = [];
      job.timeline.push({
        action: 'EMAIL_SENT',
        title: 'Email Sent via Queue',
        description: `Automated email sent to ${normEmail} (Subject: "${subject}")`,
        createdAt: new Date(),
        meta: { messageId: sendResult.messageId, isDryRun: sendResult.isDryRun },
      });

      await job.save();

      logger.info({ jobId: job._id, recipient: normEmail }, '[Queue] Job marked SENT');
      return { success: true };
    } catch (sendErr) {
      const errMsg = sendErr.message || 'Unknown email sending error';

      // Record failure in EmailLog
      emailLog.status = 'FAILED';
      emailLog.error = errMsg;
      await emailLog.save();

      // Update Job to FAILED
      job.status = 'FAILED';
      job.lastError = errMsg;
      job.retryCount = (job.retryCount || 0) + 1;
      await job.save();

      throw sendErr;
    }
  }

  /**
   * Removes / dequeues a single job from the queue.
   */
  async removeJobFromQueue(jobId, reason = 'Removed from queue by user') {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error(`Job not found with id: ${jobId}`);
    }

    const oldStatus = job.status;
    job.status = 'SKIPPED';
    job.lastError = reason;

    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'SKIPPED';

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'STATUS_CHANGED',
      title: 'Removed from Queue',
      description: reason,
      createdAt: new Date(),
      meta: { oldStatus, newStatus: 'SKIPPED', reason },
    });

    await job.save();
    logger.info({ jobId, company: job.company }, '[Queue] Job removed from queue and marked SKIPPED');
    return job;
  }

  /**
   * Verifies all currently queued jobs with active DNS MX check.
   * Automatically purges invalid / dead domains from the queue before sending.
   */
  async verifyQueuedJobs() {
    const queuedJobs = await Job.find({ status: { $in: ['QUEUED', 'APPROVED'] } });
    let validCount = 0;
    const removedJobs = [];

    for (const job of queuedJobs) {
      const email = (job.hrEmail || job.contact?.email || '').trim().toLowerCase();
      const validation = await validateEmailAddress(email, { checkMx: true });

      if (!validation.valid && validation.mxDetails?.hasMx === false) {
        const failReason = validation.reason || `Domain "${validation.domain}" has no valid MX records`;
        
        job.status = 'BOUNCED';
        job.lastError = failReason;
        if (!job.contactVerification) job.contactVerification = {};
        job.contactVerification.status = 'invalid';
        job.contactVerification.reason = failReason;

        if (!job.tracking) job.tracking = {};
        job.tracking.status = 'BOUNCED';

        if (!job.timeline) job.timeline = [];
        job.timeline.push({
          action: 'EMAIL_BOUNCED',
          title: 'DNS MX Verification Failed',
          description: `Purged from queue: ${failReason}`,
          createdAt: new Date(),
          meta: { email, reason: failReason, isPreSendPurge: true },
        });

        await job.save();

        await Contact.updateOne(
          { email },
          { $set: { status: 'BOUNCED', notes: `Verification failed: ${failReason}` } }
        );

        removedJobs.push({
          id: job._id,
          company: job.company,
          role: job.role,
          email,
          reason: failReason,
        });
      } else {
        validCount++;
      }
    }

    logger.info(
      `[Queue] Queue verification complete: ${queuedJobs.length} checked, ${validCount} valid, ${removedJobs.length} invalid removed`
    );

    return {
      totalChecked: queuedJobs.length,
      validCount,
      removedCount: removedJobs.length,
      removedJobs,
    };
  }

  /**
   * Dismisses a single failed job (marks as SKIPPED so it leaves the failed queue).
   */
  async dismissFailedJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error(`Job not found with id: ${jobId}`);
    }

    job.status = 'SKIPPED';
    job.lastError = job.lastError ? `[Dismissed] ${job.lastError}` : 'Dismissed from failed queue by user';
    await job.save();
    return job;
  }

  /**
   * Dismisses all failed jobs.
   */
  async dismissAllFailed() {
    const result = await Job.updateMany(
      { status: 'FAILED' },
      { $set: { status: 'SKIPPED' } }
    );
    return { dismissedCount: result.modifiedCount };
  }

  /**
   * Retries a specific failed job after checking MX records to prevent repeating fatal delivery errors.
   */
  async retryJob(jobId) {
    const job = await Job.findById(jobId);
    if (!job) {
      throw new Error(`Job not found with id: ${jobId}`);
    }

    if (job.status !== 'FAILED' && job.status !== 'SKIPPED') {
      throw new Error(`Only FAILED or SKIPPED jobs can be retried (current status: ${job.status})`);
    }

    const normEmail = (job.hrEmail || '').trim().toLowerCase();
    const validation = await validateEmailAddress(normEmail, { checkMx: true });
    if (!validation.valid && validation.mxDetails?.hasMx === false) {
      throw new Error(`Cannot retry: Recipient domain "${validation.domain || normEmail}" has invalid MX records (${validation.reason})`);
    }

    job.status = 'QUEUED';
    job.lastError = '';
    await job.save();

    logger.info({ jobId }, '[Queue] Job reset to QUEUED for retry');
    return job;
  }

  /**
   * Finds all follow-up-due jobs and queues them, then starts the queue.
   * Eligible statuses: FOLLOW_UP_1_DUE, FOLLOW_UP_2_DUE, and any FOLLOW_UP
   * where nextFollowUpAt <= now (overdue).
   */
  async queueAllFollowUps() {
    const now = new Date();

    // All explicitly DUE statuses
    const dueByStatus = await Job.find({
      status: { $in: ['FOLLOW_UP_1_DUE', 'FOLLOW_UP_2_DUE'] },
      'contactVerification.status': { $ne: 'invalid' },
    });

    // Overdue generic FOLLOW_UP (nextFollowUpAt in the past)
    const overdueGeneric = await Job.find({
      status: 'FOLLOW_UP',
      'tracking.nextFollowUpAt': { $lte: now },
      'contactVerification.status': { $ne: 'invalid' },
    });

    const allDue = [...dueByStatus, ...overdueGeneric];

    if (allDue.length === 0) {
      return { queuedCount: 0, message: 'No follow-up jobs are currently due.' };
    }

    const ids = allDue.map((j) => j._id);
    await Job.updateMany(
      { _id: { $in: ids }, status: { $nin: ['BOUNCED', 'FAILED', 'QUEUED', 'SENDING'] } },
      { $set: { status: 'QUEUED', lastError: '' } }
    );

    const queuedCount = allDue.length;
    logger.info(`[Queue] Queued ${queuedCount} follow-up job(s) for sending`);

    // Start the queue if not already running
    if (!this.isRunning || this.isPaused) {
      await this.startQueue();
    }

    return { queuedCount, message: `${queuedCount} follow-up email(s) queued and queue started.` };
  }

  /**
   * Retries all failed jobs up to maxRetries, skipping any with invalid DNS/MX records.
   */
  async retryAllFailed(maxRetries = 3) {
    const failedJobs = await Job.find({
      status: 'FAILED',
      retryCount: { $lt: maxRetries },
      'contactVerification.status': { $ne: 'invalid' },
    });

    let requeuedCount = 0;
    let bouncedCount = 0;

    for (const job of failedJobs) {
      const normEmail = (job.hrEmail || '').trim().toLowerCase();
      const validation = await validateEmailAddress(normEmail, { checkMx: true });

      if (validation.valid || validation.mxDetails?.hasMx !== false) {
        job.status = 'QUEUED';
        job.lastError = '';
        await job.save();
        requeuedCount++;
      } else {
        // Mark permanently bounced
        job.status = 'BOUNCED';
        job.lastError = validation.reason;
        if (!job.contactVerification) job.contactVerification = {};
        job.contactVerification.status = 'invalid';
        job.contactVerification.reason = validation.reason;
        await job.save();
        bouncedCount++;
      }
    }

    logger.info(`[Queue] Requeued ${requeuedCount} valid jobs for retry (permanently marked ${bouncedCount} invalid jobs as BOUNCED)`);
    return { modifiedCount: requeuedCount, bouncedCount };
  }

}

export const queueManager = new QueueManager();
export default queueManager;
