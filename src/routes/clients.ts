import { Router } from 'express';
import { clientsController } from '../controllers/clientsController';
import { authenticateToken, tenantMiddleware } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/tenant-isolation';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [ 'image/png', 'image/jpeg', 'image/jpg', 'application/pdf' ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// All client routes require authentication and tenant context
router.use(authenticateToken);
router.use(tenantMiddleware);
router.use(validateTenantAccess);

router.get('/', clientsController.getClients);
router.get('/:id', clientsController.getClient);
router.post('/', clientsController.createClient);
router.put('/:id', clientsController.updateClient);
router.delete('/:id', clientsController.deleteClient);
router.get('/:id/attachments', (req, res) => clientsController.listClientAttachments(req as any, res));
router.post('/:id/attachments', upload.array('attachments', 10), (req, res) => clientsController.uploadClientAttachments(req as any, res));
router.post('/:id/attachments/delete', (req, res) => clientsController.deleteClientAttachments(req as any, res));

export default router;
