// src/routes/auth.routes.ts
import { Router } from 'express';
import {
  registerNurse,
  registerDoctor,
  registerAdmin,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller';

const router = Router();

// Role-Specific Registration
router.post('/register/nurse', registerNurse);
router.post('/register/doctor', registerDoctor);
router.post('/register/admin', registerAdmin);

// Account Activation & Login
router.post('/verify-email', verifyEmail);
router.post('/login', login);

// Password Recovery
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;