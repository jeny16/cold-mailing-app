import { EmailLog } from '../models/EmailLog.js';
import { Setting } from '../models/Setting.js';
import { sendEmail, validateResume } from '../services/mail/mailService.js';
import { personalizeEmail } from '../services/personalization/templateEngine.js';
import {
  checkInboxForReplies,
  simulateIncomingReply,
  simulateIncomingBounce,
  markEmailAsBounced,
  testImapConnection,
} from '../services/mail/imapReplyTracker.js';
import { validateEmailAddress } from '../utils/emailValidator.js';

export async function getEmails(req, res) {
  try {
    const { page = 1, limit = 25, status, search } = req.query;

    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (search) {
      const s = search.trim();
      query.$or = [
        { recipient: { $regex: s, $options: 'i' } },
        { subject: { $regex: s, $options: 'i' } },
        { messageId: { $regex: s, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await EmailLog.countDocuments(query);
    const emails = await EmailLog.find(query)
      .populate('jobId', 'company role location hrName hrEmail')
      .populate('contactId', 'name company email totalEmailsSent')
      .sort({ queuedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      emails,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getEmailById(req, res) {
  try {
    const { id } = req.params;
    const email = await EmailLog.findById(id)
      .populate('jobId')
      .populate('contactId');

    if (!email) {
      return res.status(404).json({ success: false, error: 'Email log not found' });
    }

    res.json({ success: true, email });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function sendTestEmail(req, res) {
  try {
    const { testEmail, sampleRole, sampleCompany } = req.body;

    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid test recipient email is required' });
    }

    const settings = await Setting.getSettings();

    // Create a mock job for preview/test rendering
    const dummyJob = {
      company: sampleCompany || 'Acme Technologies Inc.',
      role: sampleRole || 'MERN Stack Developer',
      hrName: 'Test Recruiter',
      hrEmail: testEmail,
      location: 'Ahmedabad / Remote',
      jobUrl: 'https://example.com/careers/test',
    };

    const rendered = personalizeEmail(dummyJob, settings);
    const testSubject = `[TEST] ${rendered.subject}`;

    const resumeCheck = validateResume(settings.resumePath);

    const result = await sendEmail({
      to: testEmail.trim(),
      subject: testSubject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
      customResumePath: settings.resumePath,
      isTest: true,
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      result,
      resumeAttached: resumeCheck.valid,
      resumePath: settings.resumePath,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Checks IMAP inbox for HR replies and updates matched jobs to REPLIED status.
 */
export async function checkRepliesController(req, res) {
  try {
    const result = await checkInboxForReplies();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Simulates an incoming HR reply for testing and demo.
 */
export async function simulateReplyController(req, res) {
  try {
    const { jobId, subject, snippet } = req.body;
    const result = await simulateIncomingReply({ jobId, subject, snippet });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Tests IMAP connection with provided credentials.
 */
export async function testImapController(req, res) {
  try {
    const { host, port, user, pass } = req.body;
    const settings = await Setting.getSettings();
    const result = await testImapConnection({
      host: host || settings.imapHost,
      port: port || settings.imapPort,
      user: user || settings.imapUser,
      pass: pass || settings.imapPassword,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Simulates an incoming bounce notification (e.g. dev@ansorbit.com).
 */
export async function simulateBounceController(req, res) {
  try {
    const { jobId, bouncedEmail, reason } = req.body;
    const result = await simulateIncomingBounce({ jobId, bouncedEmail, reason });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Manually marks an email as bounced with given error reason.
 */
export async function markBouncedController(req, res) {
  try {
    const { email, jobId, reason, rawError } = req.body;
    if (!email && !jobId) {
      return res.status(400).json({ success: false, error: 'Recipient email or jobId is required' });
    }
    const result = await markEmailAsBounced({ email, jobId, reason, rawError });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Validates an email address syntax and DNS MX record status.
 */
export async function validateEmailController(req, res) {
  try {
    const { email, checkMx = true } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }
    const result = await validateEmailAddress(email, { checkMx: Boolean(checkMx) });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Returns IMAP tracking status and last sync timestamp.
 */
export async function getImapStatusController(req, res) {
  try {
    const settings = await Setting.getSettings();
    const configured = Boolean(
      (settings.imapUser || process.env.IMAP_USER || settings.senderEmail || process.env.SMTP_USER) &&
      (settings.imapPassword || process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD)
    );

    res.json({
      success: true,
      configured,
      host: settings.imapHost,
      port: settings.imapPort,
      user: settings.imapUser || settings.senderEmail || process.env.SMTP_USER || '',
      lastReplyCheckAt: settings.lastReplyCheckAt,
      repliesFoundCount: settings.repliesFoundCount || 0,
      bouncesFoundCount: settings.bouncesFoundCount || 0,
      lastBounceCheckAt: settings.lastBounceCheckAt,
      autoCheckReplies: settings.autoCheckReplies || false,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getEmails,
  getEmailById,
  sendTestEmail,
  checkRepliesController,
  simulateReplyController,
  simulateBounceController,
  markBouncedController,
  validateEmailController,
  testImapController,
  getImapStatusController,
};
