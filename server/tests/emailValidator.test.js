import { describe, it, expect } from 'vitest';
import { validateEmailFormat, validateEmailAddress } from '../src/utils/emailValidator.js';

describe('Email Hygiene & Domain Validator', () => {
  it('should accept valid standard email formats', () => {
    expect(validateEmailFormat('dev@ansorbit.com').valid).toBe(true);
    expect(validateEmailFormat('jeny.pansuriya@gmail.com').valid).toBe(true);
    expect(validateEmailFormat('contact@company.co.in').valid).toBe(true);
  });

  it('should reject invalid syntax and missing domain', () => {
    expect(validateEmailFormat('not-an-email').valid).toBe(false);
    expect(validateEmailFormat('@nodomain.com').valid).toBe(false);
    expect(validateEmailFormat('user@').valid).toBe(false);
  });

  it('should detect top-level domain typos', () => {
    const res = validateEmailFormat('recruiter@google.comm');
    expect(res.valid).toBe(false);
    expect(res.isTypo).toBe(true);
    expect(res.suggestedCorrection).toBe('recruiter@google.com');
  });

  it('should detect email provider domain typos', () => {
    const res = validateEmailFormat('candidate@gmai.com');
    expect(res.valid).toBe(false);
    expect(res.isTypo).toBe(true);
    expect(res.suggestedCorrection).toBe('candidate@gmail.com');
  });

  it('should detect placeholder and dummy domains', () => {
    const res = validateEmailFormat('hr@prospect.com');
    expect(res.valid).toBe(false);
    expect(res.isPlaceholder).toBe(true);
  });

  it('should run validateEmailAddress without errors', async () => {
    const res = await validateEmailAddress('dev@ansorbit.com', { checkMx: false });
    expect(res.valid).toBe(true);
    expect(res.domain).toBe('ansorbit.com');
  });
});
