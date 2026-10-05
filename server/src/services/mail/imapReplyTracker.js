import tls from 'tls';
import logger from '../../config/logger.js';
import { Job } from '../../models/Job.js';
import { Contact } from '../../models/Contact.js';
import { Setting } from '../../models/Setting.js';
import { EmailLog } from '../../models/EmailLog.js';

/**
 * Clean and extract email from "Name <email@domain.com>" or "email@domain.com"
 */
export function extractEmailAddress(rawFrom) {
  if (!rawFrom || typeof rawFrom !== 'string') return '';
  const match = rawFrom.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  const matchEmail = rawFrom.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (matchEmail) return matchEmail[0].trim().toLowerCase();
  return rawFrom.trim().toLowerCase();
}

/**
 * Clean sender name from "John Doe <john@domain.com>"
 */
export function extractSenderName(rawFrom) {
  if (!rawFrom || typeof rawFrom !== 'string') return '';
  const match = rawFrom.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  return rawFrom.trim();
}

/**
 * Detects if an incoming email is a delivery failure / bounce notification.
 */
export function isBounceMessage({ rawFrom = '', subject = '', bodyText = '' }) {
  const fromLower = (rawFrom || '').toLowerCase();
  const subjectLower = (subject || '').toLowerCase();
  const bodyLower = (bodyText || '').toLowerCase();

  const isFromDaemon =
    fromLower.includes('mailer-daemon') ||
    fromLower.includes('mail delivery subsystem') ||
    fromLower.includes('mail delivery system') ||
    fromLower.includes('postmaster') ||
    fromLower.includes('bounce') ||
    fromLower.includes('noreply') ||
    fromLower.includes('no-reply') ||
    fromLower.includes('googlemail.com');

  const isBounceSubject =
    subjectLower.includes('delivery status notification') ||
    subjectLower.includes('undelivered mail') ||
    subjectLower.includes('mail delivery failed') ||
    subjectLower.includes('failure notice') ||
    subjectLower.includes('returned mail') ||
    subjectLower.includes('delivery failure') ||
    subjectLower.includes('undeliverable') ||
    subjectLower.includes('could not be delivered') ||
    subjectLower.includes('delivery incomplete') ||
    subjectLower.includes('message not delivered') ||
    subjectLower.includes('delivery delay') ||
    subjectLower.includes('problem delivering');

  const isBounceBody =
    bodyLower.includes('address not found') ||
    bodyLower.includes('user does not exist') ||
    bodyLower.includes("wasn't delivered to") ||
    bodyLower.includes('could not be delivered') ||
    bodyLower.includes('550 5.1.1') ||
    bodyLower.includes('550') ||
    bodyLower.includes('user unknown') ||
    bodyLower.includes('no such user') ||
    bodyLower.includes('mailbox unavailable') ||
    bodyLower.includes('recipient address rejected') ||
    bodyLower.includes('dns error') ||
    bodyLower.includes('servfail') ||
    bodyLower.includes('nxdomain') ||
    bodyLower.includes('message not delivered') ||
    bodyLower.includes('there was a problem delivering') ||
    bodyLower.includes('temporary problem delivering') ||
    bodyLower.includes('delivery incomplete') ||
    bodyLower.includes('mx lookup') ||
    bodyLower.includes('mx record');

  return (isFromDaemon || isBounceSubject) && (isBounceSubject || isBounceBody);
}

/**
 * Extracts the bounced recipient email from delivery failure message text or headers.
 */
export function extractBouncedRecipient(messageText = '', { rawFrom = '', subject = '' } = {}, candidateEmails = []) {
  if (!messageText && !subject) return '';
  const text = `${subject}\n${messageText}`;

  // 1. Common delivery failure regex patterns
  const patterns = [
    /(?:there was a problem delivering your message to|there was a temporary problem delivering your message to|problem delivering your message to)\s*<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i,
    /(?:your message wasn'?t delivered to|wasn'?t delivered to|could not be delivered to|delivery to the following recipient(?:s)? failed|failed permanently:?|failed to deliver to:?\s*<*|unable to deliver to:?\s*<*|failed-recipient:?\s*<*)\s*<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i,
    /Final-Recipient:\s*(?:rfc822;)?\s*<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i,
    /Original-Recipient:\s*(?:rfc822;)?\s*<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i,
    /<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*\s*(?:because the address couldn'?t be found|does not exist|is unable to receive mail)/i,
    /Action:\s*failed[\s\S]{0,120}?Final-Recipient:\s*(?:rfc822;)?\s*<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const email = match[1].trim().toLowerCase();
      if (!email.includes('mailer-daemon') && !email.includes('googlemail.com') && !email.includes('postmaster')) {
        return email;
      }
    }
  }

  // 2. Cross-reference candidate emails from CRM
  if (Array.isArray(candidateEmails) && candidateEmails.length > 0) {
    for (const cand of candidateEmails) {
      const cleanCand = (cand || '').trim().toLowerCase();
      if (cleanCand && text.toLowerCase().includes(cleanCand)) {
        return cleanCand;
      }
    }
  }

  // 3. Fallback: find any non-daemon email in text
  const allEmails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  for (const rawEmail of allEmails) {
    const email = rawEmail.trim().toLowerCase();
    const isDaemon =
      email.includes('mailer-daemon') ||
      email.includes('googlemail.com') ||
      email.includes('postmaster') ||
      email.includes('bounce') ||
      email.includes('example.com');
    if (!isDaemon) {
      return email;
    }
  }

  return '';
}

/**
 * Extracts a human-readable bounce reason or SMTP error code from failure message.
 */
export function extractBounceReason(messageText = '') {
  if (!messageText) return '550 5.1.1 User does not exist - Address not found';

  // Check "The response was:" or "response was:" (common in Gmail DNS failures and remote bounces)
  const responseMatch = messageText.match(/(?:The response was|response was|response from the remote server was):\s*([^\r\n]+)/i);
  if (responseMatch && responseMatch[1]) {
    const detail = responseMatch[1].trim().replace(/[-–\s]+$/, '');
    const addressNotFound = messageText.includes('Address not found') || messageText.includes("couldn't be found");
    return addressNotFound ? `Address not found (${detail})` : detail;
  }

  // Check explicit DNS Error line
  const dnsErrorMatch = messageText.match(/(DNS Error:[^\r\n]+)/i);
  if (dnsErrorMatch && dnsErrorMatch[1]) {
    return dnsErrorMatch[1].trim();
  }

  // Check 5xx status codes (e.g. 550 5.1.1)
  const codeMatch = messageText.match(/\b(5\d{2}\s+(?:5\.\d+\.\d+)?\s*[^.\r\n]+)/i);
  if (codeMatch && codeMatch[1]) {
    const codeDetail = codeMatch[1].trim().replace(/[-–\s]+$/, '');
    const addressNotFound = messageText.includes('Address not found') || messageText.includes("couldn't be found");
    return addressNotFound ? `Address not found (${codeDetail})` : codeDetail;
  }

  if (messageText.includes('Delivery incomplete') || messageText.includes('temporary problem delivering')) {
    return 'Delivery incomplete - Temporary remote server/DNS failure';
  }

  if (messageText.includes('User does not exist') || messageText.includes('user does not exist')) {
    return '550 5.1.1 User does not exist - Address not found';
  }

  if (messageText.includes('Address not found') || messageText.includes("couldn't be found")) {
    return 'Address not found - Unable to receive mail';
  }

  if (messageText.includes('Mailbox unavailable')) {
    return '550 Mailbox unavailable';
  }

  if (messageText.includes('Quota exceeded') || messageText.includes('Mailbox full')) {
    return '552 Mailbox quota exceeded';
  }

  return '550 5.1.1 Delivery failed (Undelivered / Bounced)';
}


/**
 * Execute raw IMAP command on TLS socket with timeout
 */
function sendImapCommand(socket, tag, command, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let response = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`IMAP command "${command}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const onData = (data) => {
      response += data.toString('utf8');
      if (
        response.includes(`${tag} OK`) ||
        response.includes(`${tag} NO`) ||
        response.includes(`${tag} BAD`)
      ) {
        cleanup();
        resolve(response);
      }
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
    };

    socket.on('data', onData);
    socket.on('error', onError);

    socket.write(`${tag} ${command}\r\n`);
  });
}

/**
 * Connects to IMAP server over TLS, selects INBOX, and checks for BOTH:
 * 1. Positive HR Replies -> Updates job to REPLIED
 * 2. Delivery Failure / Bounce notifications -> Updates job to BOUNCED
 */
export async function checkInboxForReplies(options = {}) {
  const settings = options.settings || (await Setting.getSettings());

  const host = settings.imapHost || process.env.IMAP_HOST || 'imap.gmail.com';
  const port = parseInt(settings.imapPort || process.env.IMAP_PORT, 10) || 993;
  const user = (settings.imapUser || process.env.IMAP_USER || settings.senderEmail || process.env.SMTP_USER || '').trim();
  const pass = (settings.imapPassword || process.env.IMAP_PASSWORD || process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');

  if (!user || !pass) {
    logger.warn('[IMAP Tracker] Credentials not configured.');
    return {
      success: false,
      configured: false,
      checkedCount: 0,
      repliesMatched: 0,
      bouncesMatched: 0,
      message: 'IMAP credentials not configured. Please set your IMAP User and App Password in Settings to enable real-time inbox reply and bounce tracking.',
    };
  }

  logger.info(`[IMAP Tracker] Connecting to ${host}:${port} for ${user}...`);

  return new Promise((resolve) => {
    let socket = null;
    let tagCounter = 1;
    const nextTag = () => `A${tagCounter++}`;

    const cleanupAndResolve = (result) => {
      if (socket) {
        try {
          socket.write(`${nextTag()} LOGOUT\r\n`);
          socket.end();
        } catch (_) {}
      }
      resolve(result);
    };

    try {
      socket = tls.connect(
        {
          host,
          port,
          servername: host,
          rejectUnauthorized: false,
          timeout: 12000,
        },
        async () => {
          logger.info('[IMAP Tracker] TLS connection established');
          try {
            // Wait for initial greeting
            await new Promise((res) => socket.once('data', res));

            // 1. LOGIN
            const loginTag = nextTag();
            const loginResp = await sendImapCommand(socket, loginTag, `LOGIN "${user}" "${pass}"`);
            if (!loginResp.includes(`${loginTag} OK`)) {
              logger.error({ response: loginResp }, '[IMAP Tracker] Login failed');
              return cleanupAndResolve({
                success: false,
                configured: true,
                error: 'IMAP login failed. Please verify your email and app password in Settings.',
                repliesMatched: 0,
                bouncesMatched: 0,
              });
            }

            // 2. SELECT INBOX
            const selectTag = nextTag();
            const selectResp = await sendImapCommand(socket, selectTag, 'SELECT INBOX');
            if (!selectResp.includes(`${selectTag} OK`)) {
              return cleanupAndResolve({
                success: false,
                configured: true,
                error: 'Failed to select INBOX',
                repliesMatched: 0,
                bouncesMatched: 0,
              });
            }

            // 3. SEARCH for recent messages
            const searchTag = nextTag();
            const searchResp = await sendImapCommand(socket, searchTag, 'SEARCH ALL');
            const matchLine = searchResp
              .split('\n')
              .find((l) => l.startsWith('* SEARCH'));

            const messageIds = matchLine
              ? matchLine
                  .replace('* SEARCH', '')
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean)
              : [];

            logger.info(`[IMAP Tracker] Found ${messageIds.length} messages in INBOX`);

            // Check the last 50 most recent messages
            const recentIds = messageIds.slice(-50);
            let repliesMatched = 0;
            let bouncesMatched = 0;
            const matchedJobsList = [];
            const matchedBouncesList = [];

            // Pre-fetch all contacted jobs in CRM for fast O(1) matching
            const contactedJobs = await Job.find({
              status: { $in: ['EMAIL_SENT', 'WHATSAPP_SENT', 'READY_TO_CONTACT', 'SENT', 'QUEUED', 'NEW', 'REVIEW', 'APPROVED', 'BOUNCED'] },
            });

            const emailToJobMap = new Map();
            for (const j of contactedJobs) {
              const email = (j.normalizedHrEmail || j.contact?.email || j.hrEmail || '').trim().toLowerCase();
              if (email && !email.includes('prospect.com') && !email.includes('company.com')) {
                emailToJobMap.set(email, j);
              }
            }

            const candidateEmails = Array.from(emailToJobMap.keys());

            for (const msgSeq of recentIds) {
              try {
                const fetchTag = nextTag();
                const fetchResp = await sendImapCommand(
                  socket,
                  fetchTag,
                  `FETCH ${msgSeq} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE IN-REPLY-TO MESSAGE-ID)] BODY.PEEK[TEXT]<0.2500>)`
                );

                // Parse header fields
                const fromMatch = fetchResp.match(/from:\s*([^\r\n]+)/i);
                const subjectMatch = fetchResp.match(/subject:\s*([^\r\n]+)/i);
                const dateMatch = fetchResp.match(/date:\s*([^\r\n]+)/i);

                const rawFrom = fromMatch ? fromMatch[1].trim() : '';
                const subject = subjectMatch ? subjectMatch[1].trim() : '(No Subject)';
                const senderEmail = extractEmailAddress(rawFrom);
                const senderName = extractSenderName(rawFrom);
                const messageDate = dateMatch ? new Date(dateMatch[1]) : new Date();

                // Check snippet/body
                const snippet = fetchResp
                  .split('\r\n\r\n')
                  .slice(1)
                  .join(' ')
                  .replace(/[\r\n]+/g, ' ')
                  .slice(0, 400)
                  .trim();

                // --- 1. BOUNCE / DELIVERY FAILURE CHECK ---
                if (isBounceMessage({ rawFrom, subject, bodyText: fetchResp })) {
                  const bouncedEmail = extractBouncedRecipient(fetchResp, { rawFrom, subject }, candidateEmails);
                  const bounceReason = extractBounceReason(fetchResp);

                  if (bouncedEmail) {
                    let job = emailToJobMap.get(bouncedEmail);
                    if (!job) {
                      job = await Job.findOne({
                        $or: [
                          { normalizedHrEmail: bouncedEmail },
                          { hrEmail: bouncedEmail },
                          { 'contact.email': bouncedEmail },
                        ],
                      });
                    }

                    // If not found in DB, auto-create record so it's tracked
                    if (!job) {
                      const domain = bouncedEmail.split('@')[1] || '';
                      const rawCompany = domain ? domain.split('.')[0] : 'Company';
                      const cleanCompany = rawCompany.charAt(0).toUpperCase() + rawCompany.slice(1);
                      job = await Job.create({
                        company: cleanCompany.toLowerCase() === 'ansorbit' ? 'Ansorbit Technologies' : cleanCompany,
                        role: 'MERN Developer',
                        hrEmail: bouncedEmail,
                        normalizedHrEmail: bouncedEmail,
                        status: 'BOUNCED',
                        email: {
                          to: bouncedEmail,
                          status: 'bounced',
                          subject,
                          sentAt: messageDate,
                        },
                        contactVerification: {
                          status: 'invalid',
                          reason: bounceReason,
                        },
                        lastError: bounceReason,
                        tracking: {
                          status: 'BOUNCED',
                          notes: `[BOUNCED] ${bounceReason}`,
                        },
                        timeline: [
                          {
                            action: 'EMAIL_BOUNCED',
                            title: 'Email Delivery Failed / Bounced',
                            description: `Mail delivery failed to ${bouncedEmail}: ${bounceReason}`,
                            createdAt: messageDate,
                            meta: { recipient: bouncedEmail, reason: bounceReason, subject, isBounce: true },
                          },
                        ],
                      });
                    } else {
                      job.status = 'BOUNCED';
                      if (!job.email) job.email = {};
                      job.email.status = 'bounced';
                      job.contactVerification = {
                        status: 'invalid',
                        reason: bounceReason,
                      };
                      job.lastError = bounceReason;

                      if (!job.tracking) job.tracking = {};
                      job.tracking.status = 'BOUNCED';
                      job.tracking.notes = (job.tracking.notes ? job.tracking.notes + '\n' : '') + `[BOUNCED] ${bounceReason}`;

                      if (!job.timeline) job.timeline = [];
                      job.timeline.push({
                        action: 'EMAIL_BOUNCED',
                        title: 'Email Delivery Failed / Bounced',
                        description: `Mail delivery failed to ${bouncedEmail}: ${bounceReason}`,
                        createdAt: messageDate,
                        meta: { recipient: bouncedEmail, reason: bounceReason, subject, isBounce: true },
                      });
                      await job.save();
                    }

                    // Mark Contact as BOUNCED
                    await Contact.updateOne(
                      { email: bouncedEmail },
                      {
                        $set: {
                          status: 'BOUNCED',
                          notes: `[${new Date().toISOString()}] Email bounced: ${bounceReason}`,
                        },
                      }
                    );

                    // Mark EmailLog as FAILED/BOUNCED
                    await EmailLog.updateMany(
                      { recipient: bouncedEmail },
                      {
                        $set: {
                          status: 'FAILED',
                          error: `Bounced: ${bounceReason}`,
                        },
                      }
                    );

                    emailToJobMap.delete(bouncedEmail);
                    bouncesMatched++;
                    matchedBouncesList.push({
                      company: job.company,
                      role: job.role,
                      recipient: bouncedEmail,
                      reason: bounceReason,
                    });

                    logger.info(`[IMAP Tracker] Matched bounce for ${bouncedEmail} (${job.company} - ${bounceReason})!`);
                    continue;
                  }
                }

                // --- 2. POSITIVE HR REPLY CHECK & CLASSIFICATION ---
                if (senderEmail && emailToJobMap.has(senderEmail)) {
                  const job = emailToJobMap.get(senderEmail);

                  const lowerContent = `${subject} ${fetchResp}`.toLowerCase();

                  // Check if HR replied that there is no opening or requirement
                  const isNoRequirement =
                    lowerContent.includes('no opening') ||
                    lowerContent.includes('no current opening') ||
                    lowerContent.includes('no requirement') ||
                    lowerContent.includes('not hiring') ||
                    lowerContent.includes('not currently hiring') ||
                    lowerContent.includes('position has been filled') ||
                    lowerContent.includes('position is filled') ||
                    lowerContent.includes('keep your resume on file') ||
                    lowerContent.includes('keep your profile on file') ||
                    lowerContent.includes('future reference') ||
                    lowerContent.includes('no vacancies') ||
                    lowerContent.includes('not looking for') ||
                    lowerContent.includes('no suitable opening');

                  // Check if HR invited for interview/discussion
                  const isInterview =
                    lowerContent.includes('interview') ||
                    lowerContent.includes('schedule a call') ||
                    lowerContent.includes('shortlisted') ||
                    lowerContent.includes('technical discussion') ||
                    lowerContent.includes('initial discussion');

                  let targetStatus = 'REPLIED';
                  let timelineTitle = `Reply Received from ${senderName || senderEmail}`;
                  let timelineDesc = `Subject: "${subject}"\n${snippet ? `Preview: ${snippet}` : ''}`;

                  if (isNoRequirement) {
                    targetStatus = 'NO_REQUIREMENT';
                    timelineTitle = `HR Replied: No Requirement (${senderName || senderEmail})`;
                    timelineDesc = `HR stated no current opening/requirement. Follow-up permanently suppressed.\nSubject: "${subject}"\n${snippet ? `Preview: ${snippet}` : ''}`;
                  } else if (isInterview) {
                    targetStatus = 'INTERVIEW';
                    timelineTitle = `Interview Requested by ${senderName || senderEmail}`;
                  }

                  job.status = targetStatus;
                  if (!job.tracking) job.tracking = {};
                  job.tracking.status = targetStatus;
                  job.tracking.lastContactedAt = messageDate;

                  // Permanently suppress follow-up if NO_REQUIREMENT or INTERVIEW
                  if (isNoRequirement || isInterview) {
                    job.tracking.nextFollowUpAt = null;
                  }

                  if (!job.timeline) job.timeline = [];
                  job.timeline.push({
                    action: isNoRequirement ? 'NO_REQUIREMENT_RECORDED' : isInterview ? 'INTERVIEW_SCHEDULED' : 'EMAIL_REPLIED',
                    title: timelineTitle,
                    description: timelineDesc,
                    createdAt: messageDate,
                    meta: {
                      from: senderEmail,
                      name: senderName,
                      subject,
                      snippet,
                      isNoRequirement,
                      isInterview,
                    },
                  });

                  await job.save();


                  // Update contact
                  await Contact.updateOne(
                    { email: senderEmail },
                    { $set: { lastContactedAt: messageDate } }
                  );

                  emailToJobMap.delete(senderEmail);
                  repliesMatched++;
                  matchedJobsList.push({
                    company: job.company,
                    role: job.role,
                    sender: senderEmail,
                    subject,
                  });

                  logger.info(`[IMAP Tracker] Matched reply from ${senderEmail} for ${job.company} - ${job.role}!`);
                }
              } catch (fetchErr) {
                logger.warn({ error: fetchErr.message, msgSeq }, '[IMAP Tracker] Error fetching individual message');
              }
            }

            // Update settings timestamps & stats
            settings.lastReplyCheckAt = new Date();
            settings.repliesFoundCount = (settings.repliesFoundCount || 0) + repliesMatched;
            settings.bouncesFoundCount = (settings.bouncesFoundCount || 0) + bouncesMatched;
            settings.lastBounceCheckAt = new Date();
            await settings.save();

            let summaryMsg = `Checked ${recentIds.length} recent inbox emails.`;
            if (repliesMatched > 0 && bouncesMatched > 0) {
              summaryMsg = `Found ${repliesMatched} new HR reply(s) and ${bouncesMatched} bounced email(s)! Statuses updated.`;
            } else if (repliesMatched > 0) {
              summaryMsg = `Found ${repliesMatched} new HR reply(s)! Job statuses updated to REPLIED.`;
            } else if (bouncesMatched > 0) {
              summaryMsg = `Found ${bouncesMatched} bounced/invalid email(s)! Marked as BOUNCED.`;
            } else {
              summaryMsg += ' No new HR replies or bounces detected.';
            }

            cleanupAndResolve({
              success: true,
              configured: true,
              checkedCount: recentIds.length,
              repliesMatched,
              bouncesMatched,
              matchedJobs: matchedJobsList,
              matchedBounces: matchedBouncesList,
              message: summaryMsg,
            });
          } catch (execErr) {
            logger.error({ error: execErr.message }, '[IMAP Tracker] Execution error');
            cleanupAndResolve({
              success: false,
              configured: true,
              error: execErr.message,
              repliesMatched: 0,
              bouncesMatched: 0,
            });
          }
        }
      );

      socket.on('error', (socketErr) => {
        logger.error({ error: socketErr.message }, '[IMAP Tracker] Socket connection error');
        cleanupAndResolve({
          success: false,
          configured: true,
          error: `Could not connect to ${host}:${port}: ${socketErr.message}`,
          repliesMatched: 0,
          bouncesMatched: 0,
        });
      });

      socket.on('timeout', () => {
        logger.warn('[IMAP Tracker] Connection timeout');
        cleanupAndResolve({
          success: false,
          configured: true,
          error: `Connection to ${host}:${port} timed out. Check network or IMAP port.`,
          repliesMatched: 0,
          bouncesMatched: 0,
        });
      });
    } catch (outerErr) {
      cleanupAndResolve({
        success: false,
        configured: true,
        error: outerErr.message,
        repliesMatched: 0,
        bouncesMatched: 0,
      });
    }
  });
}

/**
 * Simulates an incoming email reply from an HR contact.
 */
export async function simulateIncomingReply({
  jobId = null,
  subject = 'Re: Application for Job Opening',
  snippet = 'Thank you for applying. We reviewed your profile and would like to invite you for an initial discussion.',
} = {}) {
  let job = null;

  if (jobId) {
    job = await Job.findById(jobId);
  }

  if (!job) {
    job = await Job.findOne({
      status: { $in: ['EMAIL_SENT', 'SENT', 'WHATSAPP_SENT', 'READY_TO_CONTACT', 'NEW'] },
    }).sort({ updatedAt: -1 });
  }

  if (!job) {
    job = await Job.findOne({}).sort({ updatedAt: -1 });
  }

  if (!job) {
    throw new Error('No jobs found in CRM to simulate a reply for. Please add or import a job first.');
  }

  const senderEmail = job.contact?.email || job.hrEmail || 'hr@company.com';
  const senderName = job.contact?.hrName || job.hrName || `${job.company} HR Team`;
  const replySubject = subject.includes(job.role) ? subject : `Re: Application for ${job.role} – ${job.company}`;

  job.status = 'REPLIED';
  if (!job.tracking) job.tracking = {};
  job.tracking.status = 'REPLIED';
  job.tracking.lastContactedAt = new Date();

  if (!job.timeline) job.timeline = [];
  job.timeline.push({
    action: 'EMAIL_REPLIED',
    title: `Reply Received from ${senderName}`,
    description: `Subject: "${replySubject}"\nPreview: ${snippet}`,
    createdAt: new Date(),
    meta: {
      from: senderEmail,
      name: senderName,
      subject: replySubject,
      snippet,
      isSimulated: true,
    },
  });

  await job.save();

  if (senderEmail) {
    await Contact.updateOne(
      { email: senderEmail.toLowerCase() },
      { $set: { lastContactedAt: new Date() } }
    );
  }

  const settings = await Setting.getSettings();
  settings.repliesFoundCount = (settings.repliesFoundCount || 0) + 1;
  settings.lastReplyCheckAt = new Date();
  await settings.save();

  return {
    success: true,
    job,
    message: `Simulated HR reply from ${senderName} (${senderEmail}) recorded for "${job.company} - ${job.role}"! Status changed to REPLIED.`,
  };
}

/**
 * Marks an email as bounced in the CRM and updates Job, Contact, and EmailLog.
 */
export async function markEmailAsBounced({
  email,
  jobId = null,
  reason = '550 5.1.1 User does not exist - Address not found',
  rawError = '',
} = {}) {
  const normEmail = (email || '').trim().toLowerCase();
  const bounceReason = reason || rawError || '550 5.1.1 User does not exist - Address not found';

  let job = null;
  if (jobId) {
    job = await Job.findById(jobId);
  }
  if (!job && normEmail) {
    job = await Job.findOne({
      $or: [
        { normalizedHrEmail: normEmail },
        { hrEmail: normEmail },
        { 'contact.email': normEmail },
      ],
    });
  }

  // If no existing job for this email, auto-create one
  if (!job && normEmail) {
    const domain = normEmail.split('@')[1] || '';
    const rawCompany = domain ? domain.split('.')[0] : 'Target Company';
    const cleanCompany = rawCompany.charAt(0).toUpperCase() + rawCompany.slice(1);
    job = await Job.create({
      company: cleanCompany.toLowerCase() === 'ansorbit' ? 'Ansorbit Technologies' : cleanCompany,
      role: 'MERN Developer',
      hrEmail: normEmail,
      normalizedHrEmail: normEmail,
      status: 'BOUNCED',
      email: {
        to: normEmail,
        status: 'bounced',
        subject: 'Application for MERN Developer',
      },
      contactVerification: {
        status: 'invalid',
        reason: bounceReason,
      },
      lastError: bounceReason,
      tracking: {
        status: 'BOUNCED',
        notes: `[BOUNCED] ${bounceReason}`,
      },
      timeline: [
        {
          action: 'EMAIL_BOUNCED',
          title: 'Email Delivery Failed / Bounced',
          description: `Delivery failed to ${normEmail}: ${bounceReason}`,
          createdAt: new Date(),
          meta: { recipient: normEmail, reason: bounceReason, rawError },
        },
      ],
    });
  } else if (job) {
    job.status = 'BOUNCED';
    if (!job.email) job.email = {};
    job.email.status = 'bounced';
    job.contactVerification = {
      status: 'invalid',
      reason: bounceReason,
    };
    job.lastError = bounceReason;

    if (!job.tracking) job.tracking = {};
    job.tracking.status = 'BOUNCED';
    job.tracking.notes = (job.tracking.notes ? job.tracking.notes + '\n' : '') + `[BOUNCED] ${bounceReason}`;

    if (!job.timeline) job.timeline = [];
    job.timeline.push({
      action: 'EMAIL_BOUNCED',
      title: 'Email Delivery Failed / Bounced',
      description: `Delivery failed to ${normEmail || job.hrEmail}: ${bounceReason}`,
      createdAt: new Date(),
      meta: { recipient: normEmail || job.hrEmail, reason: bounceReason, rawError },
    });
    await job.save();
  }

  if (normEmail) {
    await Contact.updateOne(
      { email: normEmail },
      {
        $set: {
          status: 'BOUNCED',
          notes: `[${new Date().toISOString()}] Email bounced: ${bounceReason}`,
        },
      },
      { upsert: false }
    );

    await EmailLog.updateMany(
      { recipient: normEmail },
      {
        $set: {
          status: 'FAILED',
          error: `Bounced: ${bounceReason}`,
        },
      }
    );
  }

  // Update Settings stats
  const settings = await Setting.getSettings();
  settings.bouncesFoundCount = (settings.bouncesFoundCount || 0) + 1;
  settings.lastBounceCheckAt = new Date();
  await settings.save();

  return {
    success: true,
    job,
    bouncedEmail: normEmail,
    reason: bounceReason,
    message: `Marked "${job?.company || normEmail}" as BOUNCED (${bounceReason})`,
  };
}

/**
 * Simulates an incoming bounce notification (e.g. dev@ansorbit.com).
 */
export async function simulateIncomingBounce({
  jobId = null,
  bouncedEmail = 'dev@ansorbit.com',
  reason = '550 5.1.1 User does not exist - Address not found',
} = {}) {
  return markEmailAsBounced({
    email: bouncedEmail,
    jobId,
    reason,
    rawError: 'The response from the remote server was: 550 5.1.1 User does not exist - Address not found',
  });
}

/**
 * Test IMAP connection and credentials
 */
export async function testImapConnection({ host, port, user, pass }) {
  if (!user || !pass) {
    return {
      success: false,
      error: 'Username and Password / App Password are required to test IMAP connection.',
    };
  }

  const targetHost = host || 'imap.gmail.com';
  const targetPort = parseInt(port, 10) || 993;

  return new Promise((resolve) => {
    let socket = null;
    let timer = null;

    const finish = (result) => {
      if (timer) clearTimeout(timer);
      if (socket) {
        try {
          socket.write('A1 LOGOUT\r\n');
          socket.end();
        } catch (_) {}
      }
      resolve(result);
    };

    timer = setTimeout(() => {
      finish({
        success: false,
        error: `Connection to ${targetHost}:${targetPort} timed out.`,
      });
    }, 10000);

    try {
      socket = tls.connect(
        {
          host: targetHost,
          port: targetPort,
          servername: targetHost,
          rejectUnauthorized: false,
        },
        async () => {
          try {
            await new Promise((res) => socket.once('data', res));
            const loginResp = await sendImapCommand(socket, 'T1', `LOGIN "${user}" "${pass.replace(/\s+/g, '')}"`);
            if (loginResp.includes('T1 OK')) {
              finish({
                success: true,
                message: `IMAP connection and login succeeded for ${user} on ${targetHost}:${targetPort}!`,
              });
            } else {
              finish({
                success: false,
                error: `IMAP login failed: ${loginResp.split('\n')[0]}`,
              });
            }
          } catch (err) {
            finish({ success: false, error: err.message });
          }
        }
      );

      socket.on('error', (err) => {
        finish({ success: false, error: `Socket error: ${err.message}` });
      });
    } catch (e) {
      finish({ success: false, error: e.message });
    }
  });
}

export default {
  extractEmailAddress,
  extractSenderName,
  isBounceMessage,
  extractBouncedRecipient,
  extractBounceReason,
  checkInboxForReplies,
  simulateIncomingReply,
  simulateIncomingBounce,
  markEmailAsBounced,
  testImapConnection,
};
