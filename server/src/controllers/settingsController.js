import path from 'path';
import fs from 'fs';
import { Setting } from '../models/Setting.js';
import { validateResume } from '../services/mail/mailService.js';
import logger from '../config/logger.js';

export async function getSettings(req, res) {
  try {
    const settings = await Setting.getSettings();
    const resumeInfo = validateResume(settings.resumePath);

    // Return non-secret settings
    res.json({
      success: true,
      settings: {
        senderName: settings.senderName,
        senderEmail: settings.senderEmail,
        senderPhone: settings.senderPhone,
        portfolioUrl: settings.portfolioUrl,
        githubUrl: settings.githubUrl,
        resumePath: settings.resumePath,
        emailSubjectTemplate: settings.emailSubjectTemplate,
        emailBodyTemplate: settings.emailBodyTemplate,
        dailyLimit: settings.dailyLimit,
        minDelaySeconds: settings.minDelaySeconds,
        maxDelaySeconds: settings.maxDelaySeconds,
        maxEmailsPerRun: settings.maxEmailsPerRun,
        dryRun: settings.dryRun,
        imapHost: settings.imapHost || 'imap.gmail.com',
        imapPort: settings.imapPort || 993,
        imapSecure: settings.imapSecure !== undefined ? settings.imapSecure : true,
        imapUser: settings.imapUser || '',
        imapConfigured: Boolean(settings.imapUser && settings.imapPassword),
        lastReplyCheckAt: settings.lastReplyCheckAt,
        repliesFoundCount: settings.repliesFoundCount || 0,
        smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
        smtpHost: process.env.SMTP_HOST || 'Not configured',
        smtpPort: process.env.SMTP_PORT || 587,
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}***` : 'None',
      },
      resumeInfo,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function updateSettings(req, res) {
  try {
    const allowedKeys = [
      'senderName',
      'senderEmail',
      'senderPhone',
      'portfolioUrl',
      'githubUrl',
      'resumePath',
      'emailSubjectTemplate',
      'emailBodyTemplate',
      'dailyLimit',
      'minDelaySeconds',
      'maxDelaySeconds',
      'maxEmailsPerRun',
      'dryRun',
      'imapHost',
      'imapPort',
      'imapSecure',
      'imapUser',
      'imapPassword',
      'autoCheckReplies',
    ];

    const updates = {};
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const settings = await Setting.getSettings();
    Object.assign(settings, updates);
    await settings.save();

    logger.info('[Settings] Updated successfully');
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function uploadResume(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    }

    const relativePath = path.relative(process.cwd(), req.file.path);
    const resumeInfo = validateResume(relativePath);

    if (!resumeInfo.valid) {
      // Remove invalid uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, error: resumeInfo.error });
    }

    const settings = await Setting.getSettings();
    settings.resumePath = relativePath;
    await settings.save();

    res.json({
      success: true,
      message: 'Resume updated successfully',
      resumePath: relativePath,
      resumeInfo,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  getSettings,
  updateSettings,
  uploadResume,
};
