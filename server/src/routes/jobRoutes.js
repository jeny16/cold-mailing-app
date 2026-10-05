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
  markNoRequirement,
  sendFollowUpEmail,
  applyFollowUpPlan,
  addActivityLog,
  updateJobStatus,
  approveJob,
  skipJob,
  batchApprove,
  batchSkip,
  batchDelete,
  previewEmail,
  cleanupDuplicatesController,
  getDuplicateStatsController,
  markJobBounced,
} from '../controllers/jobController.js';

const router = express.Router();

router.get('/', getJobs);
router.post('/', createJob);
router.get('/duplicate-stats', getDuplicateStatsController);
router.post('/cleanup-duplicates', cleanupDuplicatesController);
router.post('/batch-approve', batchApprove);
router.post('/batch-skip', batchSkip);
router.post('/batch-delete', batchDelete);
router.post('/apply-followup-plan', applyFollowUpPlan);

router.get('/:id', getJobById);
router.patch('/:id', updateJob);
router.delete('/:id', deleteJob);

// CRM Action Endpoints
router.post('/:id/send-email', sendSingleJobEmail);
router.post('/:id/whatsapp-copy', copyWhatsAppData);
router.post('/:id/whatsapp-send', markWhatsAppSent);
router.post('/:id/follow-up', scheduleFollowUp);
router.post('/:id/no-requirement', markNoRequirement);
router.post('/:id/send-followup', sendFollowUpEmail);
router.post('/:id/activity', addActivityLog);
router.patch('/:id/status', updateJobStatus);
router.post('/:id/mark-bounced', markJobBounced);

// Queue approval & preview
router.post('/:id/approve', approveJob);
router.post('/:id/skip', skipJob);
router.get('/:id/preview-email', previewEmail);

export default router;

