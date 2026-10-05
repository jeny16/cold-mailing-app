import { describe, it, expect } from 'vitest';
import {
  extractEmailAddress,
  extractSenderName,
  isBounceMessage,
  extractBouncedRecipient,
  extractBounceReason,
} from '../src/services/mail/imapReplyTracker.js';
import { validateEmailFormat } from '../src/utils/emailValidator.js';

describe('IMAP Reply & Bounce Tracker Service', () => {
  it('should extract email address from formatted From headers', () => {
    expect(extractEmailAddress('Rahul Sharma <rahul@abctech.com>')).toBe('rahul@abctech.com');
    expect(extractEmailAddress('"Pooja HR" <pooja.hr@company.co.in>')).toBe('pooja.hr@company.co.in');
    expect(extractEmailAddress('careers@startup.io')).toBe('careers@startup.io');
    expect(extractEmailAddress('  <recruitment@corp.com>  ')).toBe('recruitment@corp.com');
  });

  it('should extract clean sender name from From header', () => {
    expect(extractSenderName('Rahul Sharma <rahul@abctech.com>')).toBe('Rahul Sharma');
    expect(extractSenderName('"Pooja Talent Acquisition" <pooja@company.com>')).toBe('Pooja Talent Acquisition');
    expect(extractSenderName('hr@company.com')).toBe('hr@company.com');
  });

  it('should handle missing or malformed input safely', () => {
    expect(extractEmailAddress(null)).toBe('');
    expect(extractEmailAddress(undefined)).toBe('');
    expect(extractSenderName(null)).toBe('');
  });

  it('should accurately detect Google Mail Delivery Subsystem bounce messages', () => {
    const isBounce = isBounceMessage({
      rawFrom: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      subject: 'Delivery Status Notification (Failure)',
      bodyText: `Address not found\nYour message wasn't delivered to dev@ansorbit.com because the address couldn't be found, or is unable to receive mail.\nThe response from the remote server was:\n550 5.1.1 User does not exist -`,
    });
    expect(isBounce).toBe(true);
  });

  it('should extract the bounced recipient from Gmail failure notice', () => {
    const rawNotice = `
      Address not found
      Your message wasn't delivered to dev@ansorbit.com because the address couldn't be found, or is unable to receive mail.
      The response from the remote server was:
      550 5.1.1 User does not exist -
    `;
    const recipient = extractBouncedRecipient(rawNotice, {
      rawFrom: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      subject: 'Delivery Status Notification (Failure)',
    });
    expect(recipient).toBe('dev@ansorbit.com');
  });

  it('should extract clean bounce reason from failure body', () => {
    const rawNotice = `
      Address not found
      Your message wasn't delivered to dev@ansorbit.com because the address couldn't be found, or is unable to receive mail.
      The response from the remote server was:
      550 5.1.1 User does not exist -
    `;
    const reason = extractBounceReason(rawNotice);
    expect(reason).toContain('550 5.1.1 User does not exist');
    expect(reason).toContain('Address not found');
  });

  it('should validate email format and detect typos', () => {
    expect(validateEmailFormat('dev@ansorbit.com').valid).toBe(true);
    expect(validateEmailFormat('invalid-email').valid).toBe(false);
    expect(validateEmailFormat('test@gmail.comm').valid).toBe(false);
    expect(validateEmailFormat('test@gmail.comm').isTypo).toBe(true);
    expect(validateEmailFormat('hr@company.com').isPlaceholder).toBe(true);
  });

  it('should detect Gmail DNS SERVFAIL bounce messages for invalid domains like novasolutions.tech', () => {
    const rawFailureNotice = `
      Message not delivered
      There was a problem delivering your message to careers@novasolutions.tech. See the technical details below.
      The response was:
      DNS Error: DNS type 'mx' lookup of novasolutions.tech responded with code SERVFAIL
    `;

    const isBounce = isBounceMessage({
      rawFrom: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      subject: 'Delivery Status Notification (Failure)',
      bodyText: rawFailureNotice,
    });
    expect(isBounce).toBe(true);

    const recipient = extractBouncedRecipient(rawFailureNotice, {
      rawFrom: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      subject: 'Delivery Status Notification (Failure)',
    });
    expect(recipient).toBe('careers@novasolutions.tech');

    const reason = extractBounceReason(rawFailureNotice);
    expect(reason).toContain('DNS Error');
    expect(reason).toContain('SERVFAIL');
  });

  it('should detect Gmail Delivery incomplete temporary failure notice', () => {
    const rawDelayNotice = `
      Delivery incomplete
      There was a temporary problem delivering your message to careers@novasolutions.tech. Gmail will retry for 22 more hours. You'll be notified
    `;

    const isBounce = isBounceMessage({
      rawFrom: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      subject: 'Delivery incomplete',
      bodyText: rawDelayNotice,
    });
    expect(isBounce).toBe(true);

    const recipient = extractBouncedRecipient(rawDelayNotice, {
      rawFrom: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
      subject: 'Delivery incomplete',
    });
    expect(recipient).toBe('careers@novasolutions.tech');

    const reason = extractBounceReason(rawDelayNotice);
    expect(reason).toContain('Delivery incomplete');
  });
});

