/**
 * Template engine for personalized job applications and WhatsApp outreach.
 * Replaces {{variable}} placeholders with values.
 */
export function renderTemplate(templateString, variables = {}) {
  if (!templateString || typeof templateString !== 'string') return '';

  return templateString.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      const val = variables[key];
      return val !== null && val !== undefined ? String(val) : '';
    }
    return match;
  });
}

/**
 * Builds the complete variable dictionary for a specific job and settings.
 */
export function buildTemplateContext(job = {}, settings = {}) {
  const hrName = (job.contact?.hrName || job.hrName || '').trim();
  const hrNameOrHiringTeam = hrName ? hrName : 'Hiring Team';

  const senderName = settings.senderName || 'Jeny Pansuriya';
  const senderEmail = settings.senderEmail || 'jeny.pansuriya@example.com';
  const senderPhone = settings.senderPhone || '+91 9876543210';
  const portfolioUrl = settings.portfolioUrl || 'http://jenypansuriya.in/';
  const githubUrl = settings.githubUrl || 'https://github.com/jenypansuriya';

  return {
    company: job.company || '',
    role: job.role || '',
    hrName: hrName,
    hrNameOrHiringTeam: hrNameOrHiringTeam,
    location: job.location || job.job?.location || '',
    jobUrl: job.jobUrl || job.job?.jobUrl || '',
    senderName,
    senderEmail,
    senderPhone,
    portfolioUrl,
    githubUrl,
    // Support AI agent placeholders like in sample-jobs.json
    YOUR_EMAIL: senderEmail,
    YOUR_PHONE: senderPhone,
    YOUR_GITHUB: githubUrl,
  };
}

/**
 * Cleans the email signature so it only keeps:
 * Best regards,
 * <Sender Name>
 * and removes any other trailing lines (portfolio, github, phone, email, title).
 */
export function cleanSignature(body, senderName = 'Jeny Pansuriya') {
  if (!body || typeof body !== 'string') return '';
  return body
    .replace(/Best\s+regards,?\s*\n\s*([^\n]+)[\s\S]*$/i, (match, name) => {
      const cleanName = name && !name.includes(':') && !name.toLowerCase().includes('developer') ? name.trim() : senderName;
      return `Best regards,\n${cleanName}`;
    })
    .trim();
}

/**
 * Renders both subject and body (text and HTML) for a job.
 * If the job provides an "email" object with subject and body from AI research,
 * it uses that content directly, replacing sender tokens as appropriate.
 */
export function personalizeEmail(job, settings) {
  const context = buildTemplateContext(job, settings);

  let rawSubject = '';
  let rawBody = '';

  // 1. Prefer AI-supplied email content
  if (job?.email?.subject && job?.email?.body) {
    rawSubject = job.email.subject;
    rawBody = job.email.body;
  } else {
    // 2. Fall back to settings template
    rawSubject = settings.emailSubjectTemplate || 'Application for {{role}} – {{company}}';
    rawBody = settings.emailBodyTemplate || '';
  }

  // Substitute any template or sender placeholders (e.g. {{YOUR_EMAIL}}, {{YOUR_PHONE}}, {{company}})
  const subject = renderTemplate(rawSubject, context);
  let textBody = renderTemplate(rawBody, context);

  // Clean signature: keep only "Best regards,\n<Sender Name>"
  textBody = cleanSignature(textBody, context.senderName);

  // Convert plain text newlines into clean HTML paragraphs
  const htmlBody = textBody
    .split('\n\n')
    .map((paragraph) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${paragraph.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return {
    subject,
    textBody,
    htmlBody,
    context,
  };
}

/**
 * Strips phone formatting into clean international format (digits only).
 * Handles Indian numbers (10 digits -> 91xxxxxxxxxx).
 */
export function cleanPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Generates personalized WhatsApp outreach message for a job.
 */
export function generateWhatsAppMessage(job = {}, settings = {}) {
  // If already provided on job object and not empty, use that
  if (job?.whatsapp?.message && typeof job.whatsapp.message === 'string' && job.whatsapp.message.trim().length > 0) {
    return job.whatsapp.message.trim();
  }

  const context = buildTemplateContext(job, settings);
  const template = settings.whatsappMessageTemplate ||
    `Hi {{hrNameOrHiringTeam}}, I'm {{senderName}}, a Full Stack Developer (React / Node.js). I noticed the opening for {{role}} at {{company}} and would love to connect. You can view my portfolio at {{portfolioUrl}}. May I share my resume with you?`;

  return renderTemplate(template, context).trim();
}

/**
 * Renders standardized follow-up subject and body for a job.
 */
export function personalizeFollowUpEmail(job, settings = {}) {
  const context = buildTemplateContext(job, settings);

  const rawSubject = settings.followUpSubjectTemplate || 'Following up: Application for {{role}} – {{company}}';
  const rawBody = settings.followUpBodyTemplate ||
    `Hi {{hrNameOrHiringTeam}},\n\nI wanted to follow up on my application for the {{role}} position that I shared recently. I remain interested in the opportunity and would be happy to provide any additional information required.\n\nPlease let me know if there is any update regarding the application.\n\nBest regards,\n{{senderName}}`;

  const subject = renderTemplate(rawSubject, context);
  let textBody = renderTemplate(rawBody, context);
  textBody = cleanSignature(textBody, context.senderName);

  const htmlBody = textBody
    .split('\n\n')
    .map((paragraph) => `<p style="margin: 0 0 14px 0; line-height: 1.6;">${paragraph.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return {
    subject,
    textBody,
    htmlBody,
  };
}

/**
 * Generates the WhatsApp Click-to-Chat URL
 * Example: https://wa.me/917600436632?text=...
 */
export function generateWhatsAppUrl(phone, message) {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) return '';
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message || '')}`;
}

export default {
  renderTemplate,
  buildTemplateContext,
  personalizeEmail,
  personalizeFollowUpEmail,
  cleanPhoneNumber,
  generateWhatsAppMessage,
  generateWhatsAppUrl,
};

