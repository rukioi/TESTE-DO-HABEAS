import { Router } from 'express';
import { receivablesJobsController } from '../controllers/receivablesJobsController';
import { authenticateToken, tenantMiddleware } from '../middleware/auth';

const router = Router();

router.post('/notifications/reminder/run', (req, res) => receivablesJobsController.runReminder(req, res));
router.post('/notifications/schedule', authenticateToken, tenantMiddleware, (req, res) => receivablesJobsController.scheduleNotification(req as any, res));
router.post('/notifications/scheduler/run', (req, res) => receivablesJobsController.runScheduler(req, res));
router.get('/notifications/scheduled', authenticateToken, tenantMiddleware, (req, res) => receivablesJobsController.listScheduled(req as any, res));
router.patch('/notifications/scheduled/:id', authenticateToken, tenantMiddleware, (req, res) => receivablesJobsController.updateScheduled(req as any, res));
router.delete('/notifications/scheduled/:id', authenticateToken, tenantMiddleware, (req, res) => receivablesJobsController.deleteScheduled(req as any, res));

export default router;
