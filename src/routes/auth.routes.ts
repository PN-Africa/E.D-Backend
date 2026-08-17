import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller';

const router = Router();

// Unified Registration
router.post('/register', register);

// Account Activation & Login
router.post('/verify-email', verifyEmail);
router.post('/login', login);

// Password Recovery
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;