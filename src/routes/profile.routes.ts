import { Router } from 'express';
import { getMyProfile, updateMyProfile } from '../controllers/profile.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// RULE 1: Nurse must be logged in. 
// (We apply this to all profile routes)
router.use(authenticateToken);

router.get('/', getMyProfile);
router.put('/', updateMyProfile);

export default router;