import express from 'express';
import {
  getJobs,
  getJobById,
  updateJob,
  deleteJob,
  approveJob,
  skipJob,
  batchApprove,
  batchSkip,
  batchDelete,
  previewEmail,
} from '../controllers/jobController.js';

const router = express.Router();

router.get('/', getJobs);
router.post('/batch-approve', batchApprove);
router.post('/batch-skip', batchSkip);
router.post('/batch-delete', batchDelete);

router.get('/:id', getJobById);
router.patch('/:id', updateJob);
router.delete('/:id', deleteJob);

router.post('/:id/approve', approveJob);
router.post('/:id/skip', skipJob);
router.get('/:id/preview-email', previewEmail);

export default router;
