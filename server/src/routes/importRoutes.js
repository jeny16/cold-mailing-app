import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { importJsonFile, getImports, getImportById } from '../controllers/importController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(process.cwd(), 'data/incoming');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `upload-${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.json') {
      return cb(new Error('Only .json files are supported'));
    }
    cb(null, true);
  },
});

router.post('/upload', upload.single('file'), importJsonFile);
router.post('/direct', express.json({ limit: '10mb' }), importJsonFile);
router.get('/', getImports);
router.get('/:id', getImportById);

export default router;
