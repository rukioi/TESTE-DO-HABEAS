import { Router } from 'express';
import { authenticateToken, tenantMiddleware } from '../middleware/auth';
import { evolutionController } from '../controllers/evolutionController';

const router = Router();

router.use(authenticateToken);
router.use(tenantMiddleware);

router.post('/message/send', (req, res) => evolutionController.sendMessage(req as any, res));

router.get('/instances', (req, res) => evolutionController.fetchInstances(req as any, res));
router.get('/selected', (req, res) => evolutionController.getSelectedInstance(req, res));

export default router;

