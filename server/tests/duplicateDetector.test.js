import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizeUrl,
  generateJobKey,
} from '../src/services/duplicate/duplicateDetector.js';

describe('Duplicate Detector Service', () => {
  it('should normalize emails with mixed case and leading/trailing whitespace', () => {
    expect(normalizeEmail('HR@ABC.COM')).toBe('hr@abc.com');
    expect(normalizeEmail('  hr@abc.com  ')).toBe('hr@abc.com');
    expect(normalizeEmail(' Rahul.Recruiter@Domain.Co.In ')).toBe('rahul.recruiter@domain.co.in');
  });

  it('should consider varied casings as the exact same normalized email', () => {
    const email1 = normalizeEmail('HR@ABC.COM');
    const email2 = normalizeEmail('hr@abc.com');
    const email3 = normalizeEmail(' HR@abc.com ');

    expect(email1).toEqual(email2);
    expect(email2).toEqual(email3);
  });

  it('should normalize URLs by trimming protocol and trailing slashes', () => {
    expect(normalizeUrl('https://example.com/jobs/123/')).toBe('example.com/jobs/123');
    expect(normalizeUrl('http://example.com/jobs/123')).toBe('example.com/jobs/123');
  });

  it('should generate consistent duplicate job keys', () => {
    const key1 = generateJobKey(' ABC Corp ', ' React Dev ', 'https://abc.com/careers/1');
    const key2 = generateJobKey('abc corp', 'react dev', 'http://abc.com/careers/1/');

    expect(key1).toEqual(key2);
  });
});
