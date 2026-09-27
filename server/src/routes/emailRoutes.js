import express from 'express';
import {
  getEmails,
  getEmailById,
  sendTestEmail,
  checkRepliesController,
  simulateReplyController,
  simulateBounceController,
  markBouncedController,
  validateEmailController,
  testImapController,
  getImapStatusController,
} from '../controllers/emailController.js';

const router = express.Router();

router.get('/', getEmails);
router.post('/test', sendTestEmail);

// IMAP Reply & Bounce Tracking Endpoints
router.get('/imap-status', getImapStatusController);
router.post('/check-replies', checkRepliesController);
router.post('/simulate-reply', simulateReplyController);
router.post('/simulate-bounce', simulateBounceController);
router.post('/mark-bounced', markBouncedController);
router.post('/validate-address', validateEmailController);
router.post('/test-imap', testImapController);

router.get('/:id', getEmailById);

export default router;
