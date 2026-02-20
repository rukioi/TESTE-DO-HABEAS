import { Router } from 'express';
import { authenticateToken, requireAccountType } from '../middleware/auth';
import { usersController } from '../controllers/usersController';

const router = Router();

// Authenticated users can list collaborators of their tenant
router.use(authenticateToken);

router.get('/collaborators', usersController.getCollaborators);

router.patch('/:id/portal-access', requireAccountType(['GERENCIAL']), (req, res) => usersController.togglePortalAccess(req, res));

export default router;
