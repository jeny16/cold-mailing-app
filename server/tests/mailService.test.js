import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { validateResume, sendEmail, setTransporter } from '../src/services/mail/mailService.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Setting } from '../src/models/Setting.js';

describe('Mail Service & Resume Attachment', () => {
  beforeAll(async () => {
    await connectDB();
    await Setting.deleteMany({});
    await Setting.create({
      key: 'global_settings',
      senderName: 'Jeny Pansuriya',
      senderEmail: 'jenypansuriya2004@gmail.com',
      dryRun: true,
      resumePath: 'attachments/Jeny_Pansuriya_Resume.pdf',
    });
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('should validate existing resume PDF', () => {
    const check = validateResume('attachments/Jeny_Pansuriya_Resume.pdf');
    expect(check.valid).toBe(true);
    expect(check.filename).toBe('Jeny_Pansuriya_Resume.pdf');
  });

  it('should reject non-existent file', () => {
    const check = validateResume('attachments/does-not-exist.pdf');
    expect(check.valid).toBe(false);
    expect(check.error).toContain('does not exist');
  });

  it('should reject non-PDF file extension', () => {
    const check = validateResume('package.json');
    expect(check.valid).toBe(false);
    expect(check.error).toContain('must be a PDF');
  });

  it('should simulate delivery in DRY_RUN mode without sending real emails', async () => {
    const result = await sendEmail({
      to: 'recruiter@target-company.com',
      subject: 'Application for Frontend Developer',
      htmlBody: '<p>Sample email body</p>',
      textBody: 'Sample email body',
      customResumePath: 'attachments/Jeny_Pansuriya_Resume.pdf',
      isTest: false,
    });

    expect(result.success).toBe(true);
    expect(result.isDryRun).toBe(true);
    expect(result.messageId).toContain('dryrun-');
    expect(result.hasAttachment).toBe(true);
  });

  it('should throw an error for invalid recipient email', async () => {
    await expect(
      sendEmail({
        to: 'invalid-email-address',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
      })
    ).rejects.toThrow('Invalid recipient email');
  });
});
