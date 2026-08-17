import { Router } from 'express';
import { getBedDashboard } from '../controllers/bed.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken);
const nurseAccess = authorizeRoles('nurse', 'admin');

router.get('/dashboard', nurseAccess, getBedDashboard);

export default router;