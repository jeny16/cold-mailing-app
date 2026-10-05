import express from 'express';
import {
  getQueueStatus,
  startQueue,
  pauseQueue,
  retryJob,
  retryAll,
  removeJob,
  verifyQueue,
  dismissFailed,
  dismissAllFailed,
  queueFollowUps,
} from '../controllers/queueController.js';

const router = express.Router();

router.get('/', getQueueStatus);
router.post('/start', startQueue);
router.post('/pause', pauseQueue);
router.post('/verify', verifyQueue);
router.post('/remove/:jobId', removeJob);
router.delete('/:jobId', removeJob);
router.post('/retry-all', retryAll);
router.post('/retry/:jobId', retryJob);
router.post('/dismiss/:jobId', dismissFailed);
router.post('/dismiss-all-failed', dismissAllFailed);
router.post('/queue-followups', queueFollowUps);

export default router;

