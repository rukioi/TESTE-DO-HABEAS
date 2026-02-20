import { Router } from 'express';
import { authenticateToken, tenantMiddleware } from '../middleware/auth';
import { stripeController } from '../controllers/stripeController';

const router = Router();

router.get('/plans', authenticateToken, (req, res) => stripeController.listPlans(req, res));
router.post('/checkout/session', authenticateToken, (req, res) => stripeController.createCheckoutSession(req as any, res));
router.post('/subscriptions', authenticateToken, tenantMiddleware, (req, res) => stripeController.createSubscription(req as any, res));
router.post('/subscriptions/cancel', authenticateToken, tenantMiddleware, (req, res) => stripeController.cancelSubscription(req as any, res));
router.post('/portal/session', authenticateToken, tenantMiddleware, (req, res) => stripeController.createBillingPortalSession(req as any, res));
router.post('/subscriptions/change-plan', authenticateToken, tenantMiddleware, (req, res) => stripeController.changePlan(req as any, res));
router.post('/connect/account/create', authenticateToken, tenantMiddleware, (req, res) => stripeController.connectCreateAccount(req as any, res));
router.post('/connect/account/login', authenticateToken, tenantMiddleware, (req, res) => stripeController.connectLoginLink(req as any, res));

export default router;
