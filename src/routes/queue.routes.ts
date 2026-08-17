import { Router } from 'express';
import { getPatientQueue, getAssignedPatients } from '../controllers/queue.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// RULE 1: Nurse authentication required
router.use(authenticateToken);
const nurseAccess = authorizeRoles('nurse', 'admin');

router.get('/', nurseAccess, getPatientQueue);
router.get('/assigned', nurseAccess, getAssignedPatients);

export default router;