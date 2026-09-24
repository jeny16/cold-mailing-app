import { queueManager } from '../services/queue/queueService.js';
import { Job } from '../models/Job.js';

export async function getQueueStatus(req, res) {
  try {
    const status = await queueManager.getStatus();

    const queuedJobs = await Job.find({ status: { $in: ['QUEUED', 'SENDING'] } }).sort({ importedAt: 1 });
    const failedJobs = await Job.find({ status: 'FAILED' }).sort({ updatedAt: -1 }).limit(20);

    res.json({
      success: true,
      ...status,
      queuedJobs,
      failedJobs,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function startQueue(req, res) {
  try {
    const result = await queueManager.startQueue();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function pauseQueue(req, res) {
  try {
    const result = queueManager.pauseQueue();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function retryJob(req, res) {
  try {
    const { jobId } = req.params;
    const job = await queueManager.retryJob(jobId);
    res.json({ success: true, job });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function retryAll(req, res) {
  try {
    const result = await queueManager.retryAllFailed();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getQueueStatus,
  startQueue,
  pauseQueue,
  retryJob,
  retryAll,
};
