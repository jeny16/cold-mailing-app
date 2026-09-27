import path from 'path';
import fs from 'fs';
import { Import } from '../models/Import.js';
import { processJobsImport } from '../services/importer/jsonImporter.js';

export async function importJsonFile(req, res) {
  try {
    let content = null;
    let filename = 'manual-upload.json';
    let filePath = null;

    if (req.file) {
      filename = req.file.originalname;
      filePath = req.file.path;
      content = fs.readFileSync(filePath, 'utf-8');
    } else if (req.body && (req.body.jobs || Array.isArray(req.body))) {
      content = req.body;
      filename = req.body.filename || `direct-import-${Date.now()}.json`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please upload a .json file or provide a JSON payload with a "jobs" array',
      });
    }

    const skipDuplicates =
      req.query.skipDuplicates === 'true' ||
      req.body?.skipDuplicates === true ||
      req.body?.skipDuplicates === 'true';

    const result = await processJobsImport({
      content,
      filename,
      filePath,
      source: req.body?.source || 'Manual Web Upload',
      skipDuplicates,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getImports(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const total = await Import.countDocuments();
    const imports = await Import.find()
      .sort({ importedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      imports,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getImportById(req, res) {
  try {
    const { id } = req.params;
    const record = await Import.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Import record not found' });
    }
    res.json({ success: true, importRecord: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default {
  importJsonFile,
  getImports,
  getImportById,
};
