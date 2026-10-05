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

// In-memory DNS MX cache with 10-minute TTL to prevent redundant queries
const mxCache = new Map();
const MX_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Resolves MX (Mail Exchange) records for a domain to verify active receiving mail servers.
 * Features in-memory caching and fallback to A records per RFC 5321.
 */
export async function checkDomainMx(domain) {
  if (!domain || typeof domain !== 'string') {
    return { hasMx: false, error: 'No domain specified' };
  }

  const cleanDomain = domain.trim().toLowerCase();

  // Check cache first
  const cached = mxCache.get(cleanDomain);
  if (cached && Date.now() - cached.cachedAt < MX_CACHE_TTL_MS) {
    return cached.result;
  }

  return new Promise((resolve) => {
    // 4 second timeout for DNS check
    const timer = setTimeout(() => {
      const timeoutRes = { hasMx: null, skipped: true, error: 'DNS MX check timed out' };
      resolve(timeoutRes);
    }, 4000);

    dns.resolveMx(cleanDomain, (err, addresses) => {
      clearTimeout(timer);

      const cacheAndResolve = (result) => {
        mxCache.set(cleanDomain, { result, cachedAt: Date.now() });
        resolve(result);
      };

      if (err) {
        if (err.code === 'ESERVFAIL') {
          return cacheAndResolve({
            hasMx: false,
            error: `DNS MX lookup failed: nameservers for "${cleanDomain}" returned SERVFAIL (broken or misconfigured DNS)`,
            code: 'ESERVFAIL',
          });
        }

        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEOUT') {
          // Gracefully handle restricted network or sandbox environments
          return resolve({ hasMx: null, skipped: true, error: `DNS check skipped (${err.code})` });
        }

        if (err.code === 'ENOTFOUND') {
          return cacheAndResolve({
            hasMx: false,
            error: `Domain "${cleanDomain}" does not exist (NXDOMAIN / ENOTFOUND)`,
            code: 'ENOTFOUND',
          });
        }

        if (err.code === 'NODATA' || err.code === 'ENODATA') {
          // RFC 5321 Fallback: check if domain has an A record that accepts mail directly
          dns.resolve4(cleanDomain, (aErr, aAddresses) => {
            if (!aErr && aAddresses && aAddresses.length > 0) {
              return cacheAndResolve({
                hasMx: true,
                isFallbackA: true,
                primaryExchange: cleanDomain,
                exchanges: [cleanDomain],
              });
            }
            return cacheAndResolve({
              hasMx: false,
              error: `Domain "${cleanDomain}" has no MX mail server records`,
              code: 'ENODATA',
            });
          });
          return;
        }

        return cacheAndResolve({
          hasMx: false,
          error: `DNS lookup failed for ${cleanDomain}: ${err.message}`,
          code: err.code || 'UNKNOWN',
        });
      }

      if (!addresses || addresses.length === 0) {
        // Fallback to A record check
        dns.resolve4(cleanDomain, (aErr, aAddresses) => {
          if (!aErr && aAddresses && aAddresses.length > 0) {
            return cacheAndResolve({
              hasMx: true,
              isFallbackA: true,
              primaryExchange: cleanDomain,
              exchanges: [cleanDomain],
            });
          }
          return cacheAndResolve({
            hasMx: false,
            error: `No mail exchange records for domain "${cleanDomain}"`,
            code: 'NO_RECORDS',
          });
        });
        return;
      }

      // Sort by priority (lowest priority number = preferred server)
      addresses.sort((a, b) => a.priority - b.priority);
      return cacheAndResolve({
        hasMx: true,
        primaryExchange: addresses[0].exchange,
        exchanges: addresses.map((a) => a.exchange),
      });
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

