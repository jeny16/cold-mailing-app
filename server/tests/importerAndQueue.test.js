import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Job } from '../src/models/Job.js';
import { Contact } from '../src/models/Contact.js';
import { EmailLog } from '../src/models/EmailLog.js';
import { Setting } from '../src/models/Setting.js';
import { processJobsImport } from '../src/services/importer/jsonImporter.js';
import { queueManager } from '../src/services/queue/queueService.js';

describe('JSON Importer & Persistent Queue Integration', () => {
  beforeAll(async () => {
    await connectDB();
    await Job.deleteMany({});
    await Contact.deleteMany({});
    await EmailLog.deleteMany({});
    await Setting.deleteMany({});

    await Setting.create({
      key: 'global_settings',
      senderName: 'Jeny Pansuriya',
      senderEmail: 'jenypansuriya2004@gmail.com',
      dryRun: true,
      dailyLimit: 2, // low limit for testing
      minDelaySeconds: 1,
      maxDelaySeconds: 1,
      maxEmailsPerRun: 5,
    });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('should process a batch with valid jobs and duplicate emails', async () => {
    const rawBatch = {
      jobs: [
        {
          company: 'Acme Software',
          role: 'Full Stack Dev',
          hrName: 'Amit',
          hrEmail: 'amit@acmesoftware.com',
        },
        {
          company: 'Zenith Labs',
          role: 'Frontend Dev',
          hrName: 'Sneha',
          hrEmail: 'sneha@zenith.com',
        },
        {
          company: 'Acme Software',
          role: 'Full Stack Dev',
          hrName: 'Amit',
          hrEmail: ' AMIT@acmesoftware.COM ', // duplicate with different casing & whitespace
        },
        {
          company: 'Incomplete Corp',
          // missing role and invalid email
          hrEmail: 'bad-email',
        },
      ],
    };

    const result = await processJobsImport({
      content: rawBatch,
      filename: 'test-batch.json',
      source: 'Unit Test Agent',
    });

    expect(result.summary.total).toBe(4);
    expect(result.summary.valid).toBe(3);
    expect(result.summary.invalid).toBe(1);
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.newJobs).toBe(2);

    const dupJob = await Job.findOne({ hrEmail: ' AMIT@acmesoftware.COM ' });
    expect(dupJob).toBeDefined();
    expect(dupJob.isDuplicate).toBe(true);
  });

  it('should process queue and respect daily limit', async () => {
    // Approve the valid jobs
    await Job.updateMany({ isDuplicate: false, status: 'REVIEW' }, { $set: { status: 'APPROVED' } });

    const approvedCount = await Job.countDocuments({ status: 'APPROVED' });
    expect(approvedCount).toBeGreaterThan(0);

    // Start queue
    await queueManager.startQueue();

    // Wait briefly for queue loop to process
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const sentCount = await EmailLog.countDocuments({ status: 'SENT' });
    expect(sentCount).toBeGreaterThanOrEqual(1);

    const status = await queueManager.getStatus();
    expect(status.sentToday).toBe(sentCount);
  });

  it('should recover orphaned SENDING jobs back to QUEUED', async () => {
    const job = await Job.create({
      company: 'Crash Test Corp',
      role: 'DevOps Engineer',
      hrEmail: 'devops@crashtest.com',
      normalizedHrEmail: 'devops@crashtest.com',
      status: 'SENDING',
    });

    await queueManager.recoverOrphanedJobs();

    const recovered = await Job.findById(job._id);
    expect(recovered.status).toBe('QUEUED');
  });

  it('should allow retrying a failed job', async () => {
    const failedJob = await Job.create({
      company: 'Fail Corp',
      role: 'Tester',
      hrEmail: 'test@failcorp.com',
      normalizedHrEmail: 'test@failcorp.com',
      status: 'FAILED',
      lastError: 'SMTP timeout',
      retryCount: 1,
    });

    await queueManager.retryJob(failedJob._id);

    const requeued = await Job.findById(failedJob._id);
    expect(requeued.status).toBe('QUEUED');
    expect(requeued.lastError).toBe('');
  });
});
