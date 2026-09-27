import fs from 'fs';
import path from 'path';
import logger from '../../config/logger.js';
import { validateSingleJob } from '../../validators/jobValidator.js';
import { normalizeEmail, generateJobKey, checkDuplicate } from '../duplicate/duplicateDetector.js';
import { Job } from '../../models/Job.js';
import { Contact } from '../../models/Contact.js';
import { Setting } from '../../models/Setting.js';
import { Import } from '../../models/Import.js';
import { generateWhatsAppMessage, personalizeEmail } from '../personalization/templateEngine.js';

/**
 * Resolves data directories (data/processed, data/failed) whether running from project root or server/
 */
export function resolveDataDir(subdir) {
  let baseDir = path.resolve(process.cwd(), 'data', subdir);
  if (process.cwd().endsWith('/server') || process.cwd().endsWith('\\server')) {
    baseDir = path.resolve(process.cwd(), '..', 'data', subdir);
  }
  return baseDir;
}

/**
 * Safely moves a file from source to target directory.
 */
export function safeMoveFile(sourcePath, targetDir) {
  try {
    if (!fs.existsSync(sourcePath)) return null;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = path.basename(sourcePath);
    const timestamp = Date.now();
    const destinationPath = path.join(targetDir, `${timestamp}-${filename}`);

    fs.renameSync(sourcePath, destinationPath);
    logger.info(`[Importer] Moved ${filename} -> ${destinationPath}`);
    return destinationPath;
  } catch (err) {
    logger.error({ err: err.message, sourcePath, targetDir }, '[Importer] Error moving file');
    return null;
  }
}

/**
 * Parses and processes a jobs JSON string or object.
 *
 * @param {Object} options
 * @param {string|Object} options.content - Raw JSON string or parsed object
 * @param {string} options.filename - Original filename
 * @param {string} [options.filePath] - Absolute path if coming from file system
 * @param {string} [options.source] - AI agent / import source
 * @param {boolean} [options.skipDuplicates] - If true, do not insert duplicate jobs into the database
 */
export async function processJobsImport({
  content,
  filename = 'manual-upload.json',
  filePath = null,
  source = 'Manual Import',
  skipDuplicates = false,
}) {
  logger.info(`[Importer] Processing import for: ${filename}`);

  let parsedData = null;

  // 1. JSON parsing
  try {
    if (typeof content === 'string') {
      parsedData = JSON.parse(content);
    } else if (typeof content === 'object' && content !== null) {
      parsedData = content;
    } else {
      throw new Error('Invalid JSON payload provided: content must be string or JSON object');
    }
  } catch (parseError) {
    logger.error({ filename, error: parseError.message }, '[Importer] JSON Parse Error');

    const importRecord = await Import.create({
      filename,
      source,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 1,
      duplicateRecords: 0,
      newRecords: 0,
      status: 'FAILED',
      errors: [{ message: `JSON syntax error: ${parseError.message}` }],
    });

    if (filePath) {
      safeMoveFile(filePath, resolveDataDir('failed'));
    }

    return {
      success: false,
      importId: importRecord._id,
      summary: {
        total: 0,
        valid: 0,
        invalid: 1,
        duplicates: 0,
        newJobs: 0,
        existing: 0,
      },
      errors: [`JSON syntax error: ${parseError.message}`],
    };
  }

  // 2. Extract jobs array
  let rawJobs = [];
  if (Array.isArray(parsedData)) {
    rawJobs = parsedData;
  } else if (parsedData && Array.isArray(parsedData.jobs)) {
    rawJobs = parsedData.jobs;
  } else {
    const errorMsg = 'Invalid structure: JSON must contain a "jobs" array or be an array of jobs.';
    logger.error({ filename }, `[Importer] ${errorMsg}`);

    const importRecord = await Import.create({
      filename,
      source,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 1,
      duplicateRecords: 0,
      newRecords: 0,
      status: 'FAILED',
      errors: [{ message: errorMsg }],
    });

    if (filePath) {
      safeMoveFile(filePath, resolveDataDir('failed'));
    }

    return {
      success: false,
      importId: importRecord._id,
      summary: {
        total: 0,
        valid: 0,
        invalid: 1,
        duplicates: 0,
        newJobs: 0,
        existing: 0,
      },
      errors: [errorMsg],
    };
  }

  const importRecord = await Import.create({
    filename,
    source,
    totalRecords: rawJobs.length,
    status: 'PARTIAL',
  });

  const settings = await Setting.getSettings();

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;
  let newCount = 0;
  const validationErrors = [];
  const insertedJobs = [];

  // Track emails within this same batch to catch intra-batch duplicates
  const batchSeenEmails = new Set();

  // 3. Process each job record individually
  for (let i = 0; i < rawJobs.length; i++) {
    const rawJob = rawJobs[i];
    const validation = validateSingleJob(rawJob);

    if (!validation.success) {
      invalidCount++;
      validationErrors.push({
        index: i,
        company: rawJob?.company || 'Unknown',
        role: rawJob?.role || 'Unknown',
        errors: validation.errors,
      });
      continue;
    }

    validCount++;
    const validatedData = validation.data;
    const normEmail = normalizeEmail(validatedData.hrEmail);
    const normKey = generateJobKey(validatedData.company, validatedData.role, validatedData.jobUrl);

    // Check duplicate
    let isDup = false;
    let dupReason = '';

    if (batchSeenEmails.has(normEmail)) {
      isDup = true;
      dupReason = `Duplicate HR email found earlier in this same import batch (${normEmail})`;
    } else {
      batchSeenEmails.add(normEmail);
      const dupCheck = await checkDuplicate({
        company: validatedData.company,
        role: validatedData.role,
        hrEmail: validatedData.hrEmail,
        jobUrl: validatedData.jobUrl,
        phone: validatedData.contact?.phone,
      });

      if (dupCheck.isDuplicate) {
        isDup = true;
        dupReason = dupCheck.reason;
      }
    }

    if (isDup) {
      duplicateCount++;
      if (skipDuplicates) {
        logger.info(
          `[Importer] Skipping duplicate job (${validatedData.company} - ${validatedData.role}): ${dupReason}`
        );
        continue; // Skip DB insertion for duplicates
      }
    } else {
      newCount++;
    }

    // Auto-generate WhatsApp message if blank
    if (!validatedData.whatsapp.message || validatedData.whatsapp.message.trim().length === 0) {
      validatedData.whatsapp.message = generateWhatsAppMessage(validatedData, settings);
    }

    // Auto-generate Email subject & body if blank
    if (!validatedData.email.subject || !validatedData.email.body) {
      const rendered = personalizeEmail(validatedData, settings);
      if (!validatedData.email.subject) validatedData.email.subject = rendered.subject;
      if (!validatedData.email.body) validatedData.email.body = rendered.textBody;
      if (!validatedData.email.to) validatedData.email.to = validatedData.hrEmail;
    }

    const initialStatus = validatedData.tracking?.status || (isDup ? 'REVIEW' : 'READY_TO_CONTACT');

    // Persist Job
    const jobDoc = await Job.create({
      company: validatedData.company,
      role: validatedData.role,
      jobType: validatedData.jobType || 'specific_opening',
      hrName: validatedData.hrName,
      hrEmail: validatedData.hrEmail,
      normalizedHrEmail: normEmail,
      jobUrl: validatedData.jobUrl,
      normalizedJobKey: normKey,
      source: validatedData.source || source,
      location: validatedData.location,
      remote: validatedData.remote,
      description: validatedData.description,
      requirements: validatedData.requirements,
      notes: validatedData.notes,
      contact: validatedData.contact,
      job: validatedData.job,
      email: validatedData.email,
      whatsapp: validatedData.whatsapp,
      linkedin: validatedData.linkedin,
      tracking: {
        ...validatedData.tracking,
        status: initialStatus,
      },
      timeline: [
        {
          action: 'IMPORTED',
          title: 'Prospect Added to CRM',
          description: `Imported via ${filename} (${source})`,
          createdAt: new Date(),
        },
      ],
      contactVerification: validatedData.contactVerification || {
        status: 'unverified',
        reason: '',
      },
      status: initialStatus,
      isDuplicate: isDup,
      duplicateReason: dupReason,
      importId: importRecord._id,
      originalFilename: filename,
    });

    // Upsert Contact in contacts collection
    try {
      let contact = await Contact.findOne({ email: normEmail });
      if (!contact) {
        contact = await Contact.create({
          email: normEmail,
          name: validatedData.hrName || validatedData.contact?.hrName || '',
          company: validatedData.company,
          phone: validatedData.contact?.phone || '',
          whatsapp: validatedData.contact?.whatsapp || '',
          linkedin: validatedData.contact?.linkedin || '',
          jobs: [jobDoc._id],
        });
      } else {
        if (validatedData.contact?.phone && !contact.phone) contact.phone = validatedData.contact.phone;
        if (validatedData.contact?.whatsapp && !contact.whatsapp) contact.whatsapp = validatedData.contact.whatsapp;
        if (validatedData.contact?.linkedin && !contact.linkedin) contact.linkedin = validatedData.contact.linkedin;
        if (!contact.jobs) contact.jobs = [];
        if (!contact.jobs.some((jId) => jId.toString() === jobDoc._id.toString())) {
          contact.jobs.push(jobDoc._id);
        }
        await contact.save();
      }
    } catch (contactErr) {
      logger.warn({ err: contactErr.message }, '[Importer] Contact sync notice');
    }

    insertedJobs.push(jobDoc);
  }

  // Determine overall status
  let finalStatus = 'SUCCESS';
  if (invalidCount > 0 && validCount > 0) {
    finalStatus = 'PARTIAL';
  } else if (validCount === 0 && rawJobs.length > 0) {
    finalStatus = 'FAILED';
  }

  // Update import record
  importRecord.validRecords = validCount;
  importRecord.invalidRecords = invalidCount;
  importRecord.duplicateRecords = duplicateCount;
  importRecord.newRecords = newCount;
  importRecord.status = finalStatus;
  importRecord.errors = validationErrors;
  await importRecord.save();

  // Move source file if on disk
  if (filePath) {
    if (finalStatus === 'FAILED') {
      safeMoveFile(filePath, resolveDataDir('failed'));
    } else {
      safeMoveFile(filePath, resolveDataDir('processed'));
    }
  }

  logger.info(
    `[Importer] Finished ${filename}: Total: ${rawJobs.length}, Valid: ${validCount}, Duplicates: ${duplicateCount}, Invalid: ${invalidCount}, New: ${newCount}`
  );

  return {
    success: finalStatus !== 'FAILED',
    importId: importRecord._id,
    summary: {
      total: rawJobs.length,
      valid: validCount,
      invalid: invalidCount,
      duplicates: duplicateCount,
      newJobs: newCount,
      existing: duplicateCount,
      duplicatesSkipped: skipDuplicates ? duplicateCount : 0,
      skipDuplicates: Boolean(skipDuplicates),
    },
    errors: validationErrors,
    jobs: insertedJobs,
  };
}

export default {
  safeMoveFile,
  processJobsImport,
};
