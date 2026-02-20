import { Router } from 'express';
import { reportsController } from '../controllers/reportsController';
import { authenticateToken, tenantMiddleware } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(tenantMiddleware);

router.get('/weekly', reportsController.getWeekly);

export default router;