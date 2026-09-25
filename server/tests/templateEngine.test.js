import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  buildTemplateContext,
  personalizeEmail,
  cleanPhoneNumber,
  generateWhatsAppMessage,
  generateWhatsAppUrl,
} from '../src/services/personalization/templateEngine.js';

describe('Personalization Template Engine', () => {
  it('should substitute {{variable}} tokens accurately', () => {
    const template = 'Application for {{role}} at {{company}}';
    const result = renderTemplate(template, {
      role: 'Full Stack Developer',
      company: 'Zenith Tech',
    });
    expect(result).toBe('Application for Full Stack Developer at Zenith Tech');
  });

  it('should personalize hrName when present', () => {
    const job = {
      company: 'ABC Tech',
      role: 'MERN Developer',
      hrName: 'Rahul',
      hrEmail: 'rahul@abc.com',
    };
    const settings = {
      senderName: 'Jeny Pansuriya',
      emailBodyTemplate: 'Dear {{hrNameOrHiringTeam}},\n\nInterested in {{role}} at {{company}}.',
    };

    const rendered = personalizeEmail(job, settings);
    expect(rendered.textBody).toContain('Dear Rahul,');
    expect(rendered.textBody).toContain('Interested in MERN Developer at ABC Tech.');
  });

  it('should fallback to Hiring Team when hrName is missing or empty', () => {
    const job = {
      company: 'Nova Labs',
      role: 'Frontend Engineer',
      hrName: '',
      hrEmail: 'careers@novalabs.com',
    };
    const settings = {
      senderName: 'Jeny Pansuriya',
      emailBodyTemplate: 'Dear {{hrNameOrHiringTeam}},\n\nInterested in {{role}}.',
    };

    const rendered = personalizeEmail(job, settings);
    expect(rendered.textBody).toContain('Dear Hiring Team,');
  });

  it('should prioritize AI-supplied email subject and body over template', () => {
    const job = {
      company: 'ABC Technologies',
      role: 'MERN Stack Developer',
      hrName: 'Rahul Sharma',
      hrEmail: 'rahul@abctech.com',
      email: {
        to: 'rahul@abctech.com',
        subject: 'Application for MERN Stack Developer – Jeny Pansuriya',
        body: 'Dear Rahul Sharma,\n\nCustom AI generated pitch for ABC Technologies.\n\nEmail: {{YOUR_EMAIL}}\nPhone: {{YOUR_PHONE}}',
      },
    };

    const settings = {
      senderName: 'Jeny Pansuriya',
      senderEmail: 'jeny@example.com',
      senderPhone: '+91 9876543210',
    };

    const rendered = personalizeEmail(job, settings);
    expect(rendered.subject).toBe('Application for MERN Stack Developer – Jeny Pansuriya');
    expect(rendered.textBody).toContain('Custom AI generated pitch for ABC Technologies.');
    expect(rendered.textBody).toContain('Email: jeny@example.com');
    expect(rendered.textBody).toContain('Phone: +91 9876543210');
  });

  it('should format and clean phone numbers into international format', () => {
    expect(cleanPhoneNumber('+91 76004 36632')).toBe('917600436632');
    expect(cleanPhoneNumber('7600436632')).toBe('917600436632');
    expect(cleanPhoneNumber('+1 (555) 123-4567')).toBe('15551234567');
  });

  it('should generate personalized WhatsApp messages and click-to-chat URL', () => {
    const job = {
      company: 'TriState Technology',
      role: 'MERN Stack Developer',
      contact: {
        hrName: 'Anand',
        phone: '+917600436632',
      },
    };
    const settings = {
      senderName: 'Jeny Pansuriya',
      portfolioUrl: 'http://jenypansuriya.in',
    };

    const msg = generateWhatsAppMessage(job, settings);
    expect(msg).toContain('Hi Anand');
    expect(msg).toContain('TriState Technology');
    expect(msg).toContain('http://jenypansuriya.in');

    const url = generateWhatsAppUrl(job.contact.phone, msg);
    expect(url).toContain('https://wa.me/917600436632?text=');
    expect(url).toContain(encodeURIComponent('Hi Anand'));
  });
});
