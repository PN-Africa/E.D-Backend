import { Router } from 'express';
import { 
  getTriageQueue, 
  saveOrUpdateTriage, 
  getTriageHistory, 
  getPriorityUpdates 
} from '../controllers/triage.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// RULE 1: Nurse authentication required
router.use(authenticateToken);
const nurseAccess = authorizeRoles('nurse', 'admin');

router.get('/queue', nurseAccess, getTriageQueue);
router.post('/:visitId', nurseAccess, saveOrUpdateTriage);
router.get('/history', nurseAccess, getTriageHistory);
router.get('/priority-updates', nurseAccess, getPriorityUpdates);

export default router;