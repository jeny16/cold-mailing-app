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

  it('should gracefully handle AI leads with email: null and whatsapp: null and generate fallback email', () => {
    const aiLeadWithNulls = {
      company: 'Script Assist',
      role: 'Full Stack Engineer – Node.js / TypeScript / React',
      contact: {
        hrName: 'Recruiter',
        email: null,
        phone: '+919876543210',
      },
      email: null,
      whatsapp: null,
      linkedin: null,
    };

    const res = validateSingleJob(aiLeadWithNulls);
    expect(res.success).toBe(true);
    expect(res.data.company).toBe('Script Assist');
    expect(res.data.hrEmail).toBe('careers@scriptassist.com');
    expect(res.data.contactVerification?.status).toBe('unverified');
    expect(res.data.whatsapp.phone).toBe('+919876543210');
  });

  it('should handle placeholder emails like N/A and none by generating careers fallback', () => {
    const lead = {
      company: 'iGlobsyn Technologies',
      role: 'AI / Full Stack Developer',
      hrEmail: 'N/A',
      contact: {
        phone: '+919898989898',
      },
      email: null,
      whatsapp: null,
    };

    const res = validateSingleJob(lead);
    expect(res.success).toBe(true);
    expect(res.data.hrEmail).toBe('careers@iglobsyntechnologies.com');
  });

  it('should validate an entire batch of AI generated leads containing null objects', () => {
    const batch = {
      jobs: [
        {
          company: 'Script Assist',
          role: 'Full Stack Engineer – Node.js / TypeScript / React',
          email: null,
          whatsapp: null,
          contact: { phone: '+919999999999' },
        },
        {
          company: 'iGlobsyn Technologies',
          role: 'AI / Full Stack Developer',
          email: null,
          whatsapp: null,
          hrEmail: 'none',
        },
      ],
    };

    const res = validateJobsPayload(batch);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.data[0].hrEmail).toBe('careers@scriptassist.com');
    expect(res.data[1].hrEmail).toBe('careers@iglobsyntechnologies.com');
  });
});

