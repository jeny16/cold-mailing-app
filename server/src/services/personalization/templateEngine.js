/**
 * Template engine for personalized job applications.
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
  const hrName = (job.hrName || '').trim();
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
    location: job.location || '',
    jobUrl: job.jobUrl || '',
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

export default {
  renderTemplate,
  buildTemplateContext,
  personalizeEmail,
};
