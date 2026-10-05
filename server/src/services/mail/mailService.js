import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import logger from '../../config/logger.js';
import { Setting } from '../../models/Setting.js';
import { validateEmailAddress } from '../../utils/emailValidator.js';

let transporterInstance = null;

/**
 * Validates the resume file path, existence, extension, and file size.
 */
export function validateResume(resumePath) {
  if (!resumePath) {
    return { valid: false, error: 'Resume path is not configured' };
  }

  let resolvedPath = path.resolve(process.cwd(), resumePath);
  if (!fs.existsSync(resolvedPath)) {
    const parentPath = path.resolve(process.cwd(), '..', resumePath);
    if (fs.existsSync(parentPath)) {
      resolvedPath = parentPath;
    }
  }

  if (!fs.existsSync(resolvedPath)) {
    return { valid: false, error: `Resume file does not exist at: ${resumePath}` };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== '.pdf') {
    return { valid: false, error: `Resume must be a PDF file (found: ${ext})` };
  }

  const stats = fs.statSync(resolvedPath);
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB max
  if (stats.size > maxSizeBytes) {
    return { valid: false, error: `Resume file is too large (${(stats.size / 1024 / 1024).toFixed(2)} MB, max 10MB)` };
  }

  return {
    valid: true,
    resolvedPath,
    filename: path.basename(resolvedPath),
    size: stats.size,
  };
}

/**
 * Creates or retrieves the Nodemailer transporter.
 */
export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD ? process.env.SMTP_PASSWORD.replace(/\s+/g, '') : '';

  if (!transporterInstance) {
    if (!host || !user || !pass) {
      logger.warn('[SMTP] SMTP credentials not fully configured in .env. Using fallback JSON test transport.');
      transporterInstance = nodemailer.createTransport({
        jsonTransport: true,
      });
    } else {
      transporterInstance = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
  }

  return transporterInstance;
}

/**
 * Sets a custom transporter (used for unit testing with mocks)
 */
export function setTransporter(customTransporter) {
  transporterInstance = customTransporter;
}

/**
 * Sends an email with optional resume attachment and supports DRY_RUN mode.
 */
export async function sendEmail({ to, subject, htmlBody, textBody, customResumePath, isTest = false }) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  // Pre-send validation & DNS MX check to prevent dispatching to dead domains
  const validation = await validateEmailAddress(to, { checkMx: true });
  if (!validation.valid && validation.mxDetails?.hasMx === false) {
    throw new Error(`Email delivery blocked: ${validation.reason}`);
  }

  const settings = await Setting.getSettings();

  const dryRun = isTest ? false : settings.dryRun;

  // Resolve resume attachment
  const resumePathToUse = customResumePath || settings.resumePath || 'attachments/Jeny_Pansuriya_Resume.pdf';
  const resumeValidation = validateResume(resumePathToUse);

  const attachments = [];
  if (resumeValidation.valid) {
    attachments.push({
      filename: resumeValidation.filename,
      path: resumeValidation.resolvedPath,
      contentType: 'application/pdf',
    });
  } else {
    logger.warn({ path: resumePathToUse, err: resumeValidation.error }, '[Mail] Resume not attached');
  }

  const senderName = settings.senderName || 'Jeny Pansuriya';
  const senderEmail = settings.senderEmail || process.env.SMTP_USER || 'no-reply@example.com';
  const from = `"${senderName}" <${senderEmail}>`;

  // DRY RUN check
  if (dryRun) {
    logger.info(
      `\n------------------------------------------\n[DRY RUN]\nWould send:\nTo: ${to}\nFrom: ${from}\nSubject: ${subject}\nAttachment: ${
        resumeValidation.valid ? resumeValidation.filename : 'None'
      }\n------------------------------------------`
    );

    return {
      success: true,
      isDryRun: true,
      messageId: `dryrun-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      recipient: to,
      subject,
      hasAttachment: resumeValidation.valid,
      attachmentName: resumeValidation.valid ? resumeValidation.filename : null,
    };
  }

  // Real or test send
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    });

    logger.info({ messageId: info.messageId, to }, '[SMTP] Email sent successfully');

    return {
      success: true,
      isDryRun: false,
      messageId: info.messageId || `sent-${Date.now()}`,
      recipient: to,
      subject,
      hasAttachment: resumeValidation.valid,
      attachmentName: resumeValidation.valid ? resumeValidation.filename : null,
      previewUrl: nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null,
    };
  } catch (error) {
    logger.error({ to, error: error.message }, '[SMTP] Failed to send email');
    throw error;
  }
}

export default {
  validateResume,
  getTransporter,
  setTransporter,
  sendEmail,
};
