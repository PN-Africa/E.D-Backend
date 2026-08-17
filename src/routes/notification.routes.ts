import { Router } from 'express';
import { getNotifications } from '../controllers/notification.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// RULE 1: Nurse authentication required
router.use(authenticateToken);
const nurseAccess = authorizeRoles('nurse', 'admin');

// Endpoint for all notification buttons
router.get('/', nurseAccess, getNotifications);

export default router;