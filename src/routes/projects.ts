import { Router } from 'express';
import { projectsController } from '../controllers/projectsController';
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

// All project routes require authentication and tenant context
router.use(authenticateToken);
router.use(tenantMiddleware);
router.use(validateTenantAccess);

// Stats route deve vir antes do :id route
router.get('/stats', (req, res) => projectsController.getProjectsStats(req, res));

router.get('/', (req, res) => projectsController.getProjects(req, res));
router.get('/:id', (req, res) => projectsController.getProject(req, res));
router.post('/', (req, res) => projectsController.createProject(req, res));
router.put('/:id', (req, res) => projectsController.updateProject(req, res));
router.delete('/:id', (req, res) => projectsController.deleteProject(req, res));
router.get('/:id/attachments', (req, res) => projectsController.listProjectAttachments(req as any, res));
router.post('/:id/attachments', upload.array('attachments', 10), (req, res) => projectsController.uploadProjectAttachments(req as any, res));
router.post('/:id/attachments/delete', (req, res) => projectsController.deleteProjectAttachments(req as any, res));

export default router;
