import express from 'express';
import { getEmails, getEmailById, sendTestEmail } from '../controllers/emailController.js';

const router = express.Router();

router.get('/', getEmails);
router.get('/:id', getEmailById);
router.post('/test', sendTestEmail);

export default router;
