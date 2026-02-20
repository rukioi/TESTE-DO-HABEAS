import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { authenticateAdminToken } from '../middleware/auth';
import { evolutionController } from '../controllers/evolutionController';

const router = Router();

// All admin routes require admin authentication
router.use(authenticateAdminToken);

// Registration Keys
router.post('/keys', adminController.createRegistrationKey);
router.get('/keys', adminController.getRegistrationKeys);
router.patch('/keys/:id/revoke', adminController.revokeRegistrationKey);
router.delete('/keys/:id', adminController.deleteRegistrationKey);

// Tenant Management
router.get('/tenants', adminController.getTenants);
router.get('/tenants/:id/detail', adminController.getTenantDetail);
router.post('/tenants', adminController.createTenant);
router.put('/tenants/:id', adminController.updateTenant);
router.delete('/tenants/:id', adminController.deleteTenant);
router.patch('/tenants/:id/status', adminController.toggleTenantStatus);
router.post('/tenants/:id/assign-plan', adminController.assignPlanToTenant);

// Global Metrics
router.get('/metrics', adminController.getGlobalMetrics);

// Plans Management
router.get('/plans', adminController.getPlans);
router.post('/plans', adminController.createPlan);
router.put('/plans/:id', adminController.updatePlan);
router.delete('/plans/:id', adminController.deletePlan);

// Evolution API (Admin)
router.post('/evolution/instance/create', (req, res) => evolutionController.createInstance(req, res));
router.delete('/evolution/instance/delete', (req, res) => evolutionController.deleteInstance(req, res));
router.get('/evolution/instances', (req, res) => evolutionController.fetchInstances(req, res));
router.get('/evolution/instance/connect', (req, res) => evolutionController.connectInstance(req, res));
router.post('/evolution/webhook/connect', (req, res) => evolutionController.connectWebhook(req, res));
router.post('/evolution/message/send', (req, res) => evolutionController.sendMessage(req, res));
router.post('/evolution/selected', (req, res) => evolutionController.setSelectedInstance(req, res));
router.get('/evolution/selected', (req, res) => evolutionController.getSelectedInstance(req, res));

export default router;
