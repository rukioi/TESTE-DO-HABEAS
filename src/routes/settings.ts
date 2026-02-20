import { Router } from 'express';
import { authenticateToken, tenantMiddleware, requireSettingsAccess } from '../middleware/auth';
import { settingsController } from '../controllers/settingsController';

const router = Router();

// All settings routes require authentication and tenant context
router.use(authenticateToken);
router.use(tenantMiddleware);

// Settings only for GERENCIAL accounts
router.use(requireSettingsAccess);

router.get('/company', (req, res) => settingsController.getCompany(req as any, res));
router.put('/company', (req, res) => settingsController.updateCompany(req as any, res));
router.get('/company/export-clients', (req, res) => settingsController.exportClientsCSV(req as any, res));
router.get('/notifications', (req, res) => settingsController.getNotifications(req as any, res));
router.put('/notifications', (req, res) => settingsController.updateNotifications(req as any, res));
router.get('/integrations/stripe', (req, res) => settingsController.getStripeConfig(req as any, res));
router.put('/integrations/stripe', (req, res) => settingsController.updateStripeConfig(req as any, res));

router.get('/audit', (req, res) => settingsController.getAuditLogs(req as any, res));
router.delete('/audit', (req, res) => settingsController.clearAuditLogs(req as any, res));

// Users management (GERENCIAL only)
router.get('/users', (req, res) => settingsController.getUsers(req as any, res));
router.put('/users/:userId/account-type', (req, res) => settingsController.updateUserAccountType(req as any, res));
router.delete('/users/:userId', (req, res) => settingsController.deleteUser(req as any, res));

export default router;
