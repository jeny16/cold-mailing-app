import { describe, it, expect } from 'vitest';
import { validateSingleJob, validateJobsPayload } from '../src/validators/jobValidator.js';

describe('Job Validator (Zod)', () => {
  it('should validate a valid job entry', () => {
    const validJob = {
      company: 'ABC Technologies',
      role: 'MERN Stack Developer',
      hrName: 'Rahul',
      hrEmail: 'rahul@abctech.com',
      jobUrl: 'https://example.com/job/123',
      source: 'LinkedIn',
      location: 'Ahmedabad',
      remote: false,
      description: 'Exciting developer role',
      requirements: ['React', 'Node.js', 'MongoDB'],
      notes: 'Priority prospect',
    };

    const result = validateSingleJob(validJob);
    expect(result.success).toBe(true);
    expect(result.data.company).toBe('ABC Technologies');
    expect(result.data.hrEmail).toBe('rahul@abctech.com');
    expect(result.data.requirements).toHaveLength(3);
  });

  it('should validate user CRM extended JSON schema', () => {
    const crmJob = {
      id: 'job_001',
      company: 'TriState Technology',
      role: 'MERN Stack Developer',
      jobType: 'specific_opening',
      contact: {
        hrName: '',
        hrJobTitle: 'HR / Recruitment Team',
        email: 'career@tristatetechnology.com',
        phone: '+917600436632',
        whatsapp: '',
        linkedin: '',
      },
      job: {
        jobUrl: '',
        source: 'Company Career Page',
        location: 'Ahmedabad',
        workMode: 'Work From Office',
        employmentType: 'Full-Time',
        experienceRequired: '1-5 years',
        requirements: ['ReactJS', 'NodeJS', 'ExpressJS', 'MongoDB', 'REST APIs'],
      },
      email: {
        subject: 'Application for MERN Stack Developer – Jeny Pansuriya',
        body: 'Dear Hiring Team,\n\nI am writing to apply for the MERN Stack Developer position...',
        status: 'not_sent',
        sentAt: null,
      },
      whatsapp: {
        message: "Hi, I'm Jeny Pansuriya, a Full Stack Developer...",
        status: 'not_sent',
        copiedAt: null,
        sentAt: null,
      },
      linkedin: {
        profileUrl: '',
        message: '',
        status: 'not_contacted',
      },
      tracking: {
        status: 'new',
        createdAt: '2026-09-25T14:00:00+05:30',
        lastContactedAt: null,
        nextFollowUpAt: null,
        followUpCount: 0,
        notes: '',
      },
    };

    const result = validateSingleJob(crmJob);
    expect(result.success).toBe(true);
    expect(result.data.company).toBe('TriState Technology');
    expect(result.data.hrEmail).toBe('career@tristatetechnology.com');
    expect(result.data.contact.phone).toBe('+917600436632');
    expect(result.data.contact.whatsapp).toBe('+917600436632');
    expect(result.data.whatsapp.phone).toBe('+917600436632');
    expect(result.data.job.location).toBe('Ahmedabad');
    expect(result.data.job.requirements).toHaveLength(5);
  });

  it('should reject a job without company or role', () => {
    const missingRole = {
      company: 'ABC Technologies',
      hrEmail: 'rahul@abctech.com',
    };
    const result = validateSingleJob(missingRole);
    expect(result.success).toBe(false);
  });

  it('should reject invalid or malformed email addresses', () => {
    const badEmail = {
      company: 'ABC Technologies',
      role: 'Frontend Developer',
      hrEmail: 'not-an-email',
    };
    const result = validateSingleJob(badEmail);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid email'))).toBe(true);
  });

  it('should normalize remote field from string to boolean', () => {
    const stringRemote = {
      company: 'ABC Technologies',
      role: 'Frontend Developer',
      hrEmail: 'test@example.com',
      remote: 'true',
    };
    const result = validateSingleJob(stringRemote);
    expect(result.success).toBe(true);
    expect(result.data.remote).toBe(true);
  });

  it('should validate full jobs array payload', () => {
    const payload = {
      jobs: [
        {
          company: 'Acme Corp',
          role: 'Backend Engineer',
          hrEmail: 'careers@acme.com',
        },
      ],
    };

    const res = validateJobsPayload(payload);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
  });
});
