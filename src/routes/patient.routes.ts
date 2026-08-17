import { Router } from 'express';
import { 
  registerNewPatient, 
  quickEmergencyRegistration, 
  searchPatients, 
  getPatientDetails 
} from '../controllers/patient.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// All routes here require a valid JWT token
router.use(authenticateToken);

// Only allow Nurses (and Admins for oversight) to perform Check-ins and Searches
const checkInAccess = authorizeRoles('nurse', 'admin');

router.post('/register', checkInAccess, registerNewPatient);
router.post('/emergency-register', checkInAccess, quickEmergencyRegistration);
router.get('/search', checkInAccess, searchPatients);
router.get('/:id', checkInAccess, getPatientDetails);

export default router;