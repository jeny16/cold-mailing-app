import express from 'express';
import {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  sendSingleJobEmail,
  copyWhatsAppData,
  markWhatsAppSent,
  scheduleFollowUp,
  addActivityLog,
  updateJobStatus,
  approveJob,
  skipJob,
  batchApprove,
  batchSkip,
  batchDelete,
  previewEmail,
} from '../controllers/jobController.js';

const router = express.Router();

router.get('/', getJobs);
router.post('/', createJob);
router.post('/batch-approve', batchApprove);
router.post('/batch-skip', batchSkip);
router.post('/batch-delete', batchDelete);

router.get('/:id', getJobById);
router.patch('/:id', updateJob);
router.delete('/:id', deleteJob);

// CRM Action Endpoints
router.post('/:id/send-email', sendSingleJobEmail);
router.post('/:id/whatsapp-copy', copyWhatsAppData);
router.post('/:id/whatsapp-send', markWhatsAppSent);
router.post('/:id/follow-up', scheduleFollowUp);
router.post('/:id/activity', addActivityLog);
router.patch('/:id/status', updateJobStatus);

// Queue approval & preview
router.post('/:id/approve', approveJob);
router.post('/:id/skip', skipJob);
router.get('/:id/preview-email', previewEmail);

export default router;
