import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getSettings, updateSettings, uploadResume } from '../controllers/settingsController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(process.cwd(), 'attachments');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `resume-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return cb(new Error('Only PDF files are allowed for resume'));
    }
    cb(null, true);
  },
});

router.get('/', getSettings);
router.patch('/', updateSettings);
router.post('/resume', upload.single('resume'), uploadResume);

export default router;
