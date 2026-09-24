import { EmailLog } from '../models/EmailLog.js';
import { Setting } from '../models/Setting.js';
import { sendEmail, validateResume } from '../services/mail/mailService.js';
import { personalizeEmail } from '../services/personalization/templateEngine.js';

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

export default {
  getEmails,
  getEmailById,
  sendTestEmail,
};
