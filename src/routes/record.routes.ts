import { Router } from 'express';
import { getAllPatientRecords, getPatientRecordDetails } from '../controllers/record.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// RULE 1: Must be logged in
router.use(authenticateToken);

// Restrict access to Nurses (and Admins)
const nurseAccess = authorizeRoles('nurse', 'admin');

// Routes
router.get('/', nurseAccess, getAllPatientRecords);
router.get('/:id', nurseAccess, getPatientRecordDetails);

export default router;