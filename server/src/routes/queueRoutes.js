import express from 'express';
import {
  getQueueStatus,
  startQueue,
  pauseQueue,
  retryJob,
  retryAll,
} from '../controllers/queueController.js';

const router = express.Router();

router.get('/', getQueueStatus);
router.post('/start', startQueue);
router.post('/pause', pauseQueue);
router.post('/retry-all', retryAll);
router.post('/retry/:jobId', retryJob);

export default router;
