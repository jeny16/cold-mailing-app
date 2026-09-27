import dns from 'dns';

// Common domain typos and corrections
const TYPO_DOMAINS = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outlock.com': 'outlook.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
};

const DUMMY_DOMAINS = new Set([
  'prospect.com',
  'company.com',
  'example.com',
  'example.org',
  'example.net',
  'yourcompany.com',
  'test.com',
  'domain.com',
  'mycompany.com',
]);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates the syntax, structure, typos, and dummy status of an email address.
 */
export function validateEmailFormat(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return {
      valid: false,
      reason: 'Email is required and must be a string',
      isSyntaxValid: false,
    };
  }

  const email = rawEmail.trim().toLowerCase();

  if (!email.includes('@')) {
    return {
      valid: false,
      email,
      reason: 'Missing "@" symbol in email address',
      isSyntaxValid: false,
    };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return {
      valid: false,
      email,
      reason: 'Invalid email address structure (multiple "@" symbols)',
      isSyntaxValid: false,
    };
  }

  const [localPart, domain] = parts;

  if (!localPart) {
    return {
      valid: false,
      email,
      reason: 'Local part (before @) cannot be empty',
      isSyntaxValid: false,
    };
  }

  if (!domain || !domain.includes('.')) {
    return {
      valid: false,
      email,
      reason: 'Domain must contain a valid top-level domain (e.g. .com, .in)',
      isSyntaxValid: false,
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      email,
      reason: 'Email contains invalid characters or does not meet RFC standards',
      isSyntaxValid: false,
    };
  }

  // Check top-level domain typos (e.g. .comm, .coom)
  if (domain.endsWith('.comm') || domain.endsWith('.coom') || domain.endsWith('.cmo')) {
    const fixedDomain = domain.replace(/\.(comm|coom|cmo)$/, '.com');
    return {
      valid: false,
      email,
      reason: `Possible TLD typo in "${domain}". Did you mean "${localPart}@${fixedDomain}"?`,
      isTypo: true,
      suggestedCorrection: `${localPart}@${fixedDomain}`,
      isSyntaxValid: false,
    };
  }

  // Check domain typo
  if (TYPO_DOMAINS[domain]) {
    const suggestedDomain = TYPO_DOMAINS[domain];
    return {
      valid: false,
      email,
      reason: `Possible domain typo "${domain}". Did you mean "${localPart}@${suggestedDomain}"?`,
      isTypo: true,
      suggestedCorrection: `${localPart}@${suggestedDomain}`,
      isSyntaxValid: false,
    };
  }

  // Check dummy / placeholder domains
  if (DUMMY_DOMAINS.has(domain)) {
    return {
      valid: false,
      email,
      reason: `Placeholder domain "${domain}" detected. Real email address is required.`,
      isPlaceholder: true,
      isSyntaxValid: true,
    };
  }

  return {
    valid: true,
    email,
    localPart,
    domain,
    isSyntaxValid: true,
  };
}

/**
 * Resolves MX (Mail Exchange) records for a domain to verify active receiving mail servers.
 */
export async function checkDomainMx(domain) {
  if (!domain) return { hasMx: false, error: 'No domain specified' };

  return new Promise((resolve) => {
    // 4 second timeout for DNS check
    const timer = setTimeout(() => {
      resolve({ hasMx: null, skipped: true, error: 'DNS MX check timed out' });
    }, 4000);

    dns.resolveMx(domain, (err, addresses) => {
      clearTimeout(timer);
      if (err) {
        if (err.code === 'ENOTFOUND' || err.code === 'NODATA') {
          resolve({ hasMx: false, error: `Domain "${domain}" has no MX mail server records` });
        } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEOUT') {
          // Gracefully handle restricted network/sandbox environments
          resolve({ hasMx: null, skipped: true, error: `DNS check skipped (${err.code})` });
        } else {
          resolve({ hasMx: false, error: `DNS lookup failed for ${domain}: ${err.message}` });
        }
        return;
      }

      if (!addresses || addresses.length === 0) {
        resolve({ hasMx: false, error: `No mail exchange records for domain "${domain}"` });
      } else {
        // Sort by priority (lowest priority number = preferred server)
        addresses.sort((a, b) => a.priority - b.priority);
        resolve({
          hasMx: true,
          primaryExchange: addresses[0].exchange,
          exchanges: addresses.map((a) => a.exchange),
        });
      }
    });
  });
}

/**
 * Complete email validation: format + dummy check + optional MX lookup.
 */
export async function validateEmailAddress(rawEmail, { checkMx = false } = {}) {
  const formatResult = validateEmailFormat(rawEmail);
  if (!formatResult.valid) {
    return formatResult;
  }

  if (checkMx && formatResult.domain) {
    const mxResult = await checkDomainMx(formatResult.domain);
    if (mxResult.hasMx === false) {
      return {
        ...formatResult,
        valid: false,
        reason: mxResult.error || `Domain "${formatResult.domain}" cannot receive mail`,
        mxDetails: mxResult,
      };
    }
    return {
      ...formatResult,
      valid: true,
      mxDetails: mxResult,
    };
  }

  return formatResult;
}

export default {
  validateEmailFormat,
  checkDomainMx,
  validateEmailAddress,
};
