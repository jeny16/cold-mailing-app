import { Job } from '../models/Job.js';
import { Contact } from '../models/Contact.js';
import { EmailLog } from '../models/EmailLog.js';
import { Import } from '../models/Import.js';
import { queueManager } from '../services/queue/queueService.js';
import { Setting } from '../models/Setting.js';

export async function getStats(req, res) {
  try {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      totalJobs,
      newJobs,
      reviewJobs,
      approvedJobs,
      queuedJobs,
      sendingJobs,
      sentJobs,
      failedJobs,
      skippedJobs,
      bouncedJobs,
      totalContacts,
      totalImports,

      // CRM specific metrics
      followupsDue,
      whatsappPending,
      emailsPending,
      applicationsSent,
      replies,
      interviews,
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: { $in: ['NEW', 'RESEARCHED'] } }),
      Job.countDocuments({ status: 'REVIEW' }),
      Job.countDocuments({ status: 'APPROVED' }),
      Job.countDocuments({ status: 'QUEUED' }),
      Job.countDocuments({ status: 'SENDING' }),
      Job.countDocuments({ status: { $in: ['SENT', 'EMAIL_SENT'] } }),
      Job.countDocuments({ status: 'FAILED' }),
      Job.countDocuments({ status: 'SKIPPED' }),
      Job.countDocuments({
        $or: [
          { status: 'BOUNCED' },
          { 'email.status': 'bounced' },
          { 'contactVerification.status': 'invalid' },
        ],
      }),
      Contact.countDocuments(),
      Import.countDocuments(),

      // 🔴 Follow-ups Due
      Job.countDocuments({
        $or: [
          { status: 'FOLLOW_UP' },
          { 'tracking.nextFollowUpAt': { $ne: null, $lte: endOfToday } },
        ],
        status: { $nin: ['REJECTED', 'CLOSED'] },
      }),

      // 🟡 WhatsApp Pending
      Job.countDocuments({
        $or: [
          { status: 'WHATSAPP_PENDING' },
          {
            'whatsapp.status': { $in: ['not_sent', 'copied'] },
            $or: [{ 'contact.phone': { $ne: '' } }, { 'whatsapp.phone': { $ne: '' } }],
          },
        ],
        status: { $nin: ['REJECTED', 'CLOSED', 'WHATSAPP_SENT'] },
      }),

      // 🔵 Emails Pending
      Job.countDocuments({
        $or: [
          { 'email.status': 'not_sent' },
          { status: { $in: ['NEW', 'READY_TO_CONTACT', 'REVIEW', 'RESEARCHED', 'APPROVED'] } },
        ],
        status: { $nin: ['EMAIL_SENT', 'SENT', 'REJECTED', 'CLOSED'] },
      }),

      // 🟢 Applications Sent (Email sent or WhatsApp sent)
      Job.countDocuments({
        $or: [
          { status: { $in: ['EMAIL_SENT', 'WHATSAPP_SENT', 'SENT'] } },
          { 'email.status': 'sent' },
          { 'whatsapp.status': 'sent' },
        ],
      }),

      // 💬 Replies
      Job.countDocuments({ status: 'REPLIED' }),

      // 🎯 Interviews
      Job.countDocuments({ status: 'INTERVIEW' }),
    ]);

    const queueStatus = await queueManager.getStatus();
    const settings = await Setting.getSettings();

    const recentJobs = await Job.find().sort({ createdAt: -1 }).limit(10);
    const recentEmails = await EmailLog.find().sort({ queuedAt: -1 }).limit(5);

    res.json({
      success: true,
      stats: {
        total: totalJobs,
        new: newJobs,
        review: reviewJobs,
        approved: approvedJobs,
        queued: queuedJobs,
        sending: sendingJobs,
        sent: sentJobs,
        failed: failedJobs,
        skipped: skippedJobs,
        bounced: bouncedJobs,
        contacts: totalContacts,
        imports: totalImports,
        sentToday: queueStatus.sentToday,
        dailyLimit: settings.dailyLimit,
        queueState: queueStatus.state,
        dryRun: settings.dryRun,

        // CRM dashboard metrics
        followupsDue,
        whatsappPending,
        emailsPending,
        applicationsSent,
        replies,
        interviews,
        bouncedJobs,
        bouncesFoundCount: settings.bouncesFoundCount || 0,
      },
      recentJobs,
      recentEmails,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getStats,
};
