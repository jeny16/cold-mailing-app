import fs from 'fs';
import path from 'path';
import logger from '../../config/logger.js';
import { validateSingleJob } from '../../validators/jobValidator.js';
import { normalizeEmail, generateJobKey, checkDuplicate } from '../duplicate/duplicateDetector.js';
import { Job } from '../../models/Job.js';
import { Import } from '../../models/Import.js';

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
 */
export async function processJobsImport({ content, filename = 'manual-upload.json', filePath = null, source = 'Manual Import' }) {
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
      safeMoveFile(filePath, path.resolve(process.cwd(), 'data/failed'));
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
      safeMoveFile(filePath, path.resolve(process.cwd(), 'data/failed'));
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
      });

      if (dupCheck.isDuplicate) {
        isDup = true;
        dupReason = dupCheck.reason;
      }
    }

    if (isDup) {
      duplicateCount++;
    } else {
      newCount++;
    }

    // Persist Job
    const jobDoc = await Job.create({
      company: validatedData.company,
      role: validatedData.role,
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
      email: validatedData.email || {
        to: validatedData.hrEmail,
        subject: '',
        body: '',
      },
      contactVerification: validatedData.contactVerification || {
        status: 'unverified',
        reason: '',
      },
      status: 'REVIEW',
      isDuplicate: isDup,
      duplicateReason: dupReason,
      importId: importRecord._id,
      originalFilename: filename,
    });

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
      safeMoveFile(filePath, path.resolve(process.cwd(), 'data/failed'));
    } else {
      safeMoveFile(filePath, path.resolve(process.cwd(), 'data/processed'));
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
    },
    errors: validationErrors,
    jobs: insertedJobs,
  };
}

export default {
  safeMoveFile,
  processJobsImport,
};
