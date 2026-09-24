import { Job } from '../models/Job.js';
import { Contact } from '../models/Contact.js';
import { EmailLog } from '../models/EmailLog.js';
import { Import } from '../models/Import.js';
import { queueManager } from '../services/queue/queueService.js';
import { Setting } from '../models/Setting.js';

export async function getStats(req, res) {
  try {
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
      totalContacts,
      totalImports,
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'NEW' }),
      Job.countDocuments({ status: 'REVIEW' }),
      Job.countDocuments({ status: 'APPROVED' }),
      Job.countDocuments({ status: 'QUEUED' }),
      Job.countDocuments({ status: 'SENDING' }),
      Job.countDocuments({ status: 'SENT' }),
      Job.countDocuments({ status: 'FAILED' }),
      Job.countDocuments({ status: 'SKIPPED' }),
      Contact.countDocuments(),
      Import.countDocuments(),
    ]);

    const queueStatus = await queueManager.getStatus();
    const settings = await Setting.getSettings();

    const recentJobs = await Job.find().sort({ importedAt: -1 }).limit(5);
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
        contacts: totalContacts,
        imports: totalImports,
        sentToday: queueStatus.sentToday,
        dailyLimit: settings.dailyLimit,
        queueState: queueStatus.state,
        dryRun: settings.dryRun,
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
