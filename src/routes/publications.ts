
import { Router } from 'express';
import { publicationsController } from '../controllers/publicationsController';
import { authenticateToken, tenantMiddleware, requireActivePlan } from '../middleware/auth';

const router = Router();

// Public route: Lookup history for client portal (no auth)
router.get('/external/judit/history/lookup', publicationsController.publicHistoryLookup);
router.post('/external/judit/public/requests', publicationsController.publicCreateJuditRequest);

// All publication routes require authentication and tenant context
router.use(authenticateToken);
router.use(tenantMiddleware);
router.use(requireActivePlan);

router.get('/', publicationsController.getPublications);
router.get('/stats', publicationsController.getPublicationsStats);
router.get('/:id', publicationsController.getPublication);
router.put('/:id', publicationsController.updatePublication);
router.delete('/:id', publicationsController.deletePublication);

router.post('/external/judit/requests', publicationsController.createJuditRequest);
router.get('/external/judit/requests', publicationsController.listJuditRequests);
router.get('/external/judit/requests/:id', publicationsController.getJuditRequest);
router.post('/external/judit/requests/:id/refresh', publicationsController.refreshJuditRequest);
router.post('/external/judit/tracking', publicationsController.registerJuditTracking);
router.get('/external/judit/trackings', publicationsController.listJuditTrackings);
router.get('/external/judit/trackings/:id', publicationsController.getJuditTracking);
router.post('/external/judit/trackings/:id/pause', publicationsController.pauseJuditTracking);
router.post('/external/judit/trackings/:id/resume', publicationsController.resumeJuditTracking);
router.delete('/external/judit/trackings/:id', publicationsController.deleteJuditTracking);
router.get('/external/judit/trackings/:id/history', publicationsController.getJuditTrackingHistory);
router.get('/external/judit/history/lookup', publicationsController.historyLookup);
router.get('/external/judit/history/:responseId', publicationsController.getJuditTrackingHistoryItem);
router.get('/external/judit/quota', publicationsController.getJuditQuota);
router.post('/import/codilo', publicationsController.importFromCodilo);
router.get('/external/codilo/search', publicationsController.searchCodilo);

export default router;
